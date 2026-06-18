import type { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

import { MOCK_SERVICE_ORDERS } from '../model/mock';
import { ServiceOrderStatusEnum } from '../model/order-status';
import type { IServiceOrder, IServiceOrderPhoto } from '../model/types';

import { getDatabase } from '@/shared/lib/db';

// Database-сервис заявок — деталь реализации слайса (наружу через публичный API не выносится).
// Инкапсулирует expo-sqlite: схему, сид и запросы заявок. Соединение берёт из project-agnostic
// клиента `@/shared/lib/db`. Потребитель — только стор слайса (`useOrdersStore`).
//
// Отклонение от PDR §14: схема выравнена по фактическому `IServiceOrder`, а не дословно по PDR.
// Колонки `latitude`/`longitude`/`scheduled_at`/`created_at`/`updated_at` из §14 в домене ещё нет —
// гео и реальные даты вводятся в Phase 6 (тогда же расширяется и схема). Заполнять NOT NULL-колонки
// выдуманными данными — нарушение «не делаем фичи будущих фаз», поэтому таблицы отражают реальные поля.

// Row-интерфейсы: представление строк таблиц (snake_case колонки). Маппятся на домен (camelCase).
interface IServiceOrderRow {
  id: string;
  status: string;
  title: string;
  client: string;
  address: string;
  description: string;
  scheduled_time: string;
  scheduled_slot: string;
  distance_label: string;
}

interface IServiceOrderPhotoRow {
  id: string;
  order_id: string;
  uri: string;
  comment: string | null;
  created_at: string;
}

// DDL схемы: обе таблицы + внешний ключ фото на заявку. Идемпотентно (IF NOT EXISTS).
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS service_orders (
    id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    title TEXT NOT NULL,
    client TEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    scheduled_slot TEXT NOT NULL,
    distance_label TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS service_order_photos (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT NOT NULL,
    uri TEXT NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(order_id) REFERENCES service_orders(id)
  );
`;

// Мапперы (чистые, типизированные): snake_case строка БД ↔ camelCase домен.
const rowToPhoto = (row: IServiceOrderPhotoRow): IServiceOrderPhoto => ({
  id: row.id,
  uri: row.uri,
  // `comment` опционален в домене: NULL из БД → отсутствие ключа.
  ...(row.comment !== null ? { comment: row.comment } : {}),
  createdAt: row.created_at,
});

const rowToOrder = (row: IServiceOrderRow, photos: IServiceOrderPhoto[]): IServiceOrder => ({
  id: row.id,
  // В колонке хранятся значения ServiceOrderStatusEnum (запись контролируется сервисом).
  status: row.status as ServiceOrderStatusEnum,
  title: row.title,
  client: row.client,
  address: row.address,
  description: row.description,
  scheduledTime: row.scheduled_time,
  scheduledSlot: row.scheduled_slot,
  distanceLabel: row.distance_label,
  photos,
});

const orderToRow = (order: IServiceOrder): IServiceOrderRow => ({
  id: order.id,
  status: order.status,
  title: order.title,
  client: order.client,
  address: order.address,
  description: order.description,
  scheduled_time: order.scheduledTime,
  scheduled_slot: order.scheduledSlot,
  distance_label: order.distanceLabel,
});

const photoToRow = (orderId: string, photo: IServiceOrderPhoto): IServiceOrderPhotoRow => ({
  id: photo.id,
  order_id: orderId,
  uri: photo.uri,
  comment: photo.comment ?? null,
  created_at: photo.createdAt,
});

// Вставка заявки. Параметризованный runAsync с плейсхолдерами — без интерполяции (защита от SQL-инъекции).
const insertOrder = (database: SQLiteDatabase, order: IServiceOrder): Promise<SQLiteRunResult> => {
  const row = orderToRow(order);

  return database.runAsync(
    `INSERT INTO service_orders
       (id, status, title, client, address, description, scheduled_time, scheduled_slot, distance_label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.status,
    row.title,
    row.client,
    row.address,
    row.description,
    row.scheduled_time,
    row.scheduled_slot,
    row.distance_label,
  );
};

// Вставка фото заявки. Тоже только через плейсхолдеры.
const insertPhoto = (
  database: SQLiteDatabase,
  orderId: string,
  photo: IServiceOrderPhoto,
): Promise<SQLiteRunResult> => {
  const row = photoToRow(orderId, photo);

  return database.runAsync(
    'INSERT INTO service_order_photos (id, order_id, uri, comment, created_at) VALUES (?, ?, ?, ?, ?)',
    row.id,
    row.order_id,
    row.uri,
    row.comment,
    row.created_at,
  );
};

// Группирует строки фото по order_id (заявка → её фото), маппя каждую строку в домен.
const groupPhotosByOrderId = (rows: IServiceOrderPhotoRow[]): Map<string, IServiceOrderPhoto[]> => {
  const grouped = new Map<string, IServiceOrderPhoto[]>();

  for (const row of rows) {
    const photos = grouped.get(row.order_id) ?? [];
    photos.push(rowToPhoto(row));
    grouped.set(row.order_id, photos);
  }

  return grouped;
};

export const orderDatabaseService = {
  // Создаёт схему и включает foreign keys. DDL/PRAGMA — через execAsync (bulk, без параметров).
  async initDatabase(): Promise<void> {
    try {
      const database = await getDatabase();
      await database.execAsync(
        `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; ${SCHEMA_SQL}`,
      );
      console.info('[orderDatabaseService.initDatabase] БД инициализирована.');
    } catch (error) {
      console.error('[orderDatabaseService.initDatabase] Не удалось инициализировать БД.', error);
      throw error;
    }
  },

  // Идемпотентный сид: наполняет БД из MOCK_SERVICE_ORDERS только когда таблица пуста.
  async seedDatabaseIfNeeded(): Promise<void> {
    try {
      const database = await getDatabase();
      const countRow = await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM service_orders',
      );

      if ((countRow?.count ?? 0) > 0) {
        console.info('[orderDatabaseService.seedDatabaseIfNeeded] Сид пропущен (данные есть).');

        return;
      }

      // Вся партия сида — в одной транзакции (атомарность: либо все строки, либо ни одной).
      await database.withTransactionAsync(async () => {
        for (const order of MOCK_SERVICE_ORDERS) {
          await insertOrder(database, order);

          for (const photo of order.photos) {
            await insertPhoto(database, order.id, photo);
          }
        }
      });

      console.info(
        `[orderDatabaseService.seedDatabaseIfNeeded] Сид выполнен (${MOCK_SERVICE_ORDERS.length}).`,
      );
    } catch (error) {
      console.error('[orderDatabaseService.seedDatabaseIfNeeded] Не удалось выполнить сид.', error);
      throw error;
    }
  },

  // Возвращает все заявки с прикреплёнными фото (группировка фото по order_id в JS).
  async getOrders(): Promise<IServiceOrder[]> {
    try {
      const database = await getDatabase();
      const orderRows = await database.getAllAsync<IServiceOrderRow>(
        'SELECT * FROM service_orders',
      );
      const photoRows = await database.getAllAsync<IServiceOrderPhotoRow>(
        'SELECT * FROM service_order_photos',
      );
      const photosByOrderId = groupPhotosByOrderId(photoRows);

      return orderRows.map((row) => rowToOrder(row, photosByOrderId.get(row.id) ?? []));
    } catch (error) {
      console.error('[orderDatabaseService.getOrders] Не удалось получить заявки.', error);
      throw error;
    }
  },

  // Возвращает заявку по id с её фото или null. Caller в Phase 4 нет (детали читаются из памяти
  // стора) — метод контракта §14 на будущие фазы.
  async getOrderById(orderId: string): Promise<IServiceOrder | null> {
    try {
      const database = await getDatabase();
      const orderRow = await database.getFirstAsync<IServiceOrderRow>(
        'SELECT * FROM service_orders WHERE id = ?',
        orderId,
      );

      if (!orderRow) {
        return null;
      }

      const photoRows = await database.getAllAsync<IServiceOrderPhotoRow>(
        'SELECT * FROM service_order_photos WHERE order_id = ?',
        orderId,
      );

      return rowToOrder(orderRow, photoRows.map(rowToPhoto));
    } catch (error) {
      console.error('[orderDatabaseService.getOrderById] Не удалось получить заявку.', error);
      throw error;
    }
  },

  // Персистит смену статуса заявки. Параметризованный UPDATE (без интерполяции).
  async updateOrderStatus(orderId: string, status: ServiceOrderStatusEnum): Promise<void> {
    try {
      const database = await getDatabase();
      await database.runAsync('UPDATE service_orders SET status = ? WHERE id = ?', status, orderId);
    } catch (error) {
      console.error('[orderDatabaseService.updateOrderStatus] Не удалось обновить статус.', error);
      throw error;
    }
  },

  // Добавляет фото к заявке. Отклонение от §14 `addOrderPhoto(photo)`: в IServiceOrderPhoto нет
  // поля orderId, поэтому он передаётся отдельным аргументом. Caller — Phase 5 (камера), без UI-привязки.
  async addOrderPhoto(orderId: string, photo: IServiceOrderPhoto): Promise<void> {
    try {
      const database = await getDatabase();
      await insertPhoto(database, orderId, photo);
    } catch (error) {
      console.error('[orderDatabaseService.addOrderPhoto] Не удалось добавить фото.', error);
      throw error;
    }
  },

  // Полностью очищает обе таблицы. Фото удаляются раньше заявок из-за внешнего ключа.
  async clearDatabase(): Promise<void> {
    try {
      const database = await getDatabase();
      await database.execAsync('DELETE FROM service_order_photos; DELETE FROM service_orders;');
      console.info('[orderDatabaseService.clearDatabase] Локальная БД очищена.');
    } catch (error) {
      console.error('[orderDatabaseService.clearDatabase] Не удалось очистить БД.', error);
      throw error;
    }
  },
};
