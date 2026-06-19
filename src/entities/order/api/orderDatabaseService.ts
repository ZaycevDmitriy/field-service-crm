import { File, Paths } from 'expo-file-system';
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
// Колонок `scheduled_at`/`created_at`/`updated_at` из §14 в домене пока нет (реальные даты — позже).
// Phase 6 добавила `latitude`/`longitude` и убрала производный `distance_label`; схема версионируется
// через `PRAGMA user_version` с ручной миграцией v1→v2 в `initDatabase` (см. migrateOrdersSchema).

// Версия схемы БД. Поднимать при изменении DDL; миграция выполняется вручную в initDatabase.
const DATABASE_VERSION = 2;

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
  latitude: number;
  longitude: number;
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
    latitude REAL NOT NULL,
    longitude REAL NOT NULL
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

// URI фото: в БД храним ОТНОСИТЕЛЬНЫЙ путь (photos/<file>), а рантайм/стор работают с АБСОЛЮТНЫМ.
// На iOS абсолютный путь Paths.document (UUID контейнера) меняется при новом билде/переустановке
// (expo/expo#32788), поэтому абсолютный URI ломается, а относительный — переживает. Реконструкция
// локализована здесь, в api-слое. Фото камеры/галереи копируются в Paths.document/photos
// (см. photoService.persistPhoto); внешние и mock-схемы (mock://, http(s)://) не конвертируются.

// Абсолютный file://-URI под document-каталогом → относительный путь; прочие схемы — как есть.
const toStoredUri = (uri: string): string => {
  const documentUri = Paths.document.uri;

  return uri.startsWith(documentUri) ? uri.slice(documentUri.length).replace(/^\/+/, '') : uri;
};

// Относительный путь без URI-схемы → абсолютный URI под текущим document-каталогом; URI со схемой — как есть.
const toRuntimeUri = (stored: string): string =>
  stored.includes('://') ? stored : new File(Paths.document, stored).uri;

// Мапперы (чистые, типизированные): snake_case строка БД ↔ camelCase домен.
const rowToPhoto = (row: IServiceOrderPhotoRow): IServiceOrderPhoto => ({
  id: row.id,
  uri: toRuntimeUri(row.uri),
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
  latitude: row.latitude,
  longitude: row.longitude,
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
  latitude: order.latitude,
  longitude: order.longitude,
});

const photoToRow = (orderId: string, photo: IServiceOrderPhoto): IServiceOrderPhotoRow => ({
  id: photo.id,
  order_id: orderId,
  uri: toStoredUri(photo.uri),
  comment: photo.comment ?? null,
  created_at: photo.createdAt,
});

// Вставка заявки. Параметризованный runAsync с плейсхолдерами — без интерполяции (защита от SQL-инъекции).
const insertOrder = (database: SQLiteDatabase, order: IServiceOrder): Promise<SQLiteRunResult> => {
  const row = orderToRow(order);

  return database.runAsync(
    `INSERT INTO service_orders
       (id, status, title, client, address, description, scheduled_time, scheduled_slot, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.status,
    row.title,
    row.client,
    row.address,
    row.description,
    row.scheduled_time,
    row.scheduled_slot,
    row.latitude,
    row.longitude,
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

// Миграция схемы заявок до v2 (Phase 6): добавляет координаты в существующие установки и убирает
// производный distance_label. Идемпотентна и безопасна для свежих установок — операции применяются
// только если фактическая схема таблицы этого требует (интроспекция через PRAGMA table_info).
const migrateOrdersSchema = async (database: SQLiteDatabase): Promise<void> => {
  const columns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(service_orders);',
  );
  const columnNames = new Set(columns.map((column) => column.name));

  // v1 → v2: координаты. ADD COLUMN — nullable (SQLite запрещает ADD COLUMN NOT NULL к непустой
  // таблице без DEFAULT); NOT NULL остаётся только в CREATE для свежих установок.
  if (!columnNames.has('latitude')) {
    await database.execAsync(
      'ALTER TABLE service_orders ADD COLUMN latitude REAL;' +
        ' ALTER TABLE service_orders ADD COLUMN longitude REAL;',
    );
    // Backfill по id из сид-данных: единственные заявки в legacy-БД — сид order-1..6 (формы создания
    // заявок ещё нет). Условие latitude IS NULL делает повторный прогон безопасным.
    for (const order of MOCK_SERVICE_ORDERS) {
      await database.runAsync(
        'UPDATE service_orders SET latitude = ?, longitude = ? WHERE id = ? AND latitude IS NULL',
        order.latitude,
        order.longitude,
        order.id,
      );
    }
  }

  // Убираем производную колонку (PDR §13: производное не храним). DROP COLUMN — SQLite 3.35+ (Expo);
  // FK фото ссылается на id, поэтому снимки не затрагиваются.
  if (columnNames.has('distance_label')) {
    await database.execAsync('ALTER TABLE service_orders DROP COLUMN distance_label;');
  }
};

export const orderDatabaseService = {
  // Создаёт схему, включает foreign keys и применяет миграции по PRAGMA user_version.
  // DDL/PRAGMA — через execAsync (bulk, без параметров); CREATE IF NOT EXISTS для свежих установок
  // создаёт таблицы уже с координатами, для существующих — no-op (доводит migrateOrdersSchema).
  async initDatabase(): Promise<void> {
    try {
      const database = await getDatabase();
      await database.execAsync(
        `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; ${SCHEMA_SQL}`,
      );

      const versionRow = await database.getFirstAsync<{ user_version: number }>(
        'PRAGMA user_version;',
      );
      const currentVersion = versionRow?.user_version ?? 0;

      if (currentVersion < DATABASE_VERSION) {
        await migrateOrdersSchema(database);
        // user_version нельзя параметризовать; DATABASE_VERSION — модульная числовая константа.
        await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
        console.info(
          `[orderDatabaseService.initDatabase] Схема мигрирована ${currentVersion} → ${DATABASE_VERSION}.`,
        );
      }

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
