import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

import { MOCK_SERVICE_ORDERS } from '../model/mock';
import { isServiceOrderStatus, ServiceOrderStatusEnum } from '../model/order-status';
import type { IServiceOrder, IServiceOrderPhoto } from '../model/types';

import { getDatabase } from '@/shared/lib/db';
import { deleteFileQuietly } from '@/shared/lib/fs';
import { logger } from '@/shared/lib/logger';

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
// export — для unit-теста (см. __tests__/orderDatabaseService.test.ts).
export interface IServiceOrderRow {
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

export interface IServiceOrderPhotoRow {
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
// export — для unit-теста (см. __tests__/orderDatabaseService.test.ts), потребитель в рантайме
// остаётся только этот модуль.
export const toStoredUri = (uri: string): string => {
  const documentUri = Paths.document.uri;

  return uri.startsWith(documentUri) ? uri.slice(documentUri.length).replace(/^\/+/, '') : uri;
};

// Относительный путь без URI-схемы → абсолютный URI под текущим document-каталогом; URI со схемой — как есть.
export const toRuntimeUri = (stored: string): string =>
  stored.includes('://') ? stored : new File(Paths.document, stored).uri;

// Мапперы (чистые, типизированные): snake_case строка БД ↔ camelCase домен.
export const rowToPhoto = (row: IServiceOrderPhotoRow): IServiceOrderPhoto => ({
  id: row.id,
  uri: toRuntimeUri(row.uri),
  // `comment` опционален в домене: NULL из БД → отсутствие ключа.
  ...(row.comment !== null ? { comment: row.comment } : {}),
  createdAt: row.created_at,
});

// Невалидный статус (повреждённая строка, ручное редактирование БД) не должен ронять рендер списка —
// заявка остаётся видимой и рабочей с фоллбэком на New.
const resolveOrderStatus = (rawStatus: string): ServiceOrderStatusEnum => {
  if (isServiceOrderStatus(rawStatus)) {
    return rawStatus;
  }
  logger.warn('[orderDatabaseService.rowToOrder] Невалидный статус заявки, фоллбэк на New.', {
    status: rawStatus,
  });

  return ServiceOrderStatusEnum.New;
};

export const rowToOrder = (row: IServiceOrderRow, photos: IServiceOrderPhoto[]): IServiceOrder => ({
  id: row.id,
  status: resolveOrderStatus(row.status),
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
// производный distance_label. Идемпотентна, возобновляема и безопасна для свежих установок —
// операции применяются только если фактическая схема таблицы этого требует (интроспекция через
// PRAGMA table_info). Вызывается ИСКЛЮЧИТЕЛЬНО с транзакционным соединением (`txn` из
// withExclusiveTransactionAsync, см. initDatabase) — kill посреди миграции откатывает ВСЕ операции
// (ALTER + backfill + PRAGMA user_version) целиком, а не оставляет схему в промежуточном состоянии.
// export — для unit-теста (см. __tests__/orderDatabaseService.test.ts).
export const migrateOrdersSchema = async (database: SQLiteDatabase): Promise<void> => {
  const columns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(service_orders);',
  );
  const columnNames = new Set(columns.map((column) => column.name));

  // v1 → v2: координаты. Каждая колонка проверяется и добавляется независимо — прерванный прошлый
  // прогон мог успеть добавить latitude, но не longitude (или наоборот). ADD COLUMN — nullable
  // (SQLite запрещает ADD COLUMN NOT NULL к непустой таблице без DEFAULT); NOT NULL остаётся только
  // в CREATE для свежих установок.
  if (!columnNames.has('latitude')) {
    logger.debug('[orderDatabaseService.migrateOrdersSchema] Добавляю колонку latitude.');
    await database.execAsync('ALTER TABLE service_orders ADD COLUMN latitude REAL;');
  }

  if (!columnNames.has('longitude')) {
    logger.debug('[orderDatabaseService.migrateOrdersSchema] Добавляю колонку longitude.');
    await database.execAsync('ALTER TABLE service_orders ADD COLUMN longitude REAL;');
  }

  // Backfill по id из сид-данных выполняется безусловно (не только когда ALTER только что отработал):
  // единственные заявки в legacy-БД — сид order-1..6 (формы создания заявок ещё нет), и первые 6
  // локаций генератора mock.ts закреплены именно за этими id; UPDATE по остальным id сида — no-op
  // (строк нет). Условие latitude IS NULL в самом запросе делает его no-op и для уже заполненных
  // строк — повторный прогон после прерванной миграции безопасен.
  for (const order of MOCK_SERVICE_ORDERS) {
    const result = await database.runAsync(
      'UPDATE service_orders SET latitude = ?, longitude = ? WHERE id = ? AND latitude IS NULL',
      order.latitude,
      order.longitude,
      order.id,
    );
    logger.debug(
      `[orderDatabaseService.migrateOrdersSchema] Backfill ${order.id}: изменено строк ${result.changes}.`,
    );
  }

  // Убираем производную колонку (PDR §13: производное не храним). DROP COLUMN — SQLite 3.35+ (Expo);
  // FK фото ссылается на id, поэтому снимки не затрагиваются.
  if (columnNames.has('distance_label')) {
    logger.debug('[orderDatabaseService.migrateOrdersSchema] Удаляю колонку distance_label.');
    await database.execAsync('ALTER TABLE service_orders DROP COLUMN distance_label;');
  }
};

export const orderDatabaseService = {
  // Создаёт схему, включает foreign keys и применяет миграции по PRAGMA user_version.
  // DDL/PRAGMA создания схемы — через execAsync (bulk, без параметров); CREATE IF NOT EXISTS для
  // свежих установок создаёт таблицы уже с координатами, для существующих — no-op (доводит
  // migrateOrdersSchema). Сама миграция выполняется в withExclusiveTransactionAsync на отдельном
  // соединении: ALTER-ы, backfill и PRAGMA user_version атомарны — kill в любой момент либо
  // откатывает всё, либо (после коммита) оставляет схему полностью на v2, промежуточных состояний
  // между прогонами initDatabase быть не может.
  async initDatabase(): Promise<void> {
    // Ошибку не ловим: пробрасываем вызывающему (useOrdersStore), который ставит store.error и
    // логирует один раз — без двойного лога на двух слоях.
    const database = await getDatabase();
    await database.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; ${SCHEMA_SQL}`);

    const versionRow = await database.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version;',
    );
    const currentVersion = versionRow?.user_version ?? 0;

    if (currentVersion < DATABASE_VERSION) {
      logger.info(
        `[orderDatabaseService.initDatabase] Запускаю миграцию схемы ${currentVersion} → ${DATABASE_VERSION}.`,
      );
      await database.withExclusiveTransactionAsync(async (txn) => {
        await migrateOrdersSchema(txn);
        // user_version нельзя параметризовать; DATABASE_VERSION — модульная числовая константа.
        // Запрос — через txn, не database: в транзакцию withExclusiveTransactionAsync попадают
        // только запросы, выполненные через её колбэк-параметр.
        await txn.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
      });
      logger.info(
        `[orderDatabaseService.initDatabase] Схема мигрирована ${currentVersion} → ${DATABASE_VERSION}.`,
      );
    }

    logger.info('[orderDatabaseService.initDatabase] БД инициализирована.');
  },

  // Идемпотентный сид: наполняет БД из MOCK_SERVICE_ORDERS только когда таблица пуста.
  async seedDatabaseIfNeeded(): Promise<void> {
    const database = await getDatabase();
    const countRow = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM service_orders',
    );

    if ((countRow?.count ?? 0) > 0) {
      logger.info('[orderDatabaseService.seedDatabaseIfNeeded] Сид пропущен (данные есть).');

      return;
    }

    // Вся партия сида — в withExclusiveTransactionAsync: только эксклюзивная транзакция
    // гарантирует атомарность (обычная withTransactionAsync не изолирует конкурентные запросы
    // того же соединения, см. комментарий getOrders).
    await database.withExclusiveTransactionAsync(async (txn) => {
      for (const order of MOCK_SERVICE_ORDERS) {
        await insertOrder(txn, order);

        for (const photo of order.photos) {
          await insertPhoto(txn, order.id, photo);
        }
      }
    });

    logger.info(
      `[orderDatabaseService.seedDatabaseIfNeeded] Сид выполнен (${MOCK_SERVICE_ORDERS.length}).`,
    );
  },

  // Возвращает все заявки с прикреплёнными фото (группировка фото по order_id в JS). Оба SELECT —
  // в withExclusiveTransactionAsync: `withTransactionAsync` не изолирует — конкурентные запросы
  // того же соединения включаются в открытую транзакцию и откатываются вместе с ней (например,
  // fire-and-forget записи стора persistStatus/addOrderPhoto), эксклюзивная транзакция выполняется
  // на отдельном соединении. На web не поддерживается — SQLite-слой проекта и так native-only.
  async getOrders(): Promise<IServiceOrder[]> {
    const database = await getDatabase();
    let orderRows: IServiceOrderRow[] = [];
    let photoRows: IServiceOrderPhotoRow[] = [];

    await database.withExclusiveTransactionAsync(async (txn) => {
      orderRows = await txn.getAllAsync<IServiceOrderRow>('SELECT * FROM service_orders');
      photoRows = await txn.getAllAsync<IServiceOrderPhotoRow>(
        'SELECT * FROM service_order_photos',
      );
    });

    const photosByOrderId = groupPhotosByOrderId(photoRows);

    return orderRows.map((row) => rowToOrder(row, photosByOrderId.get(row.id) ?? []));
  },

  // Персистит смену статуса заявки. Параметризованный UPDATE (без интерполяции).
  async updateOrderStatus(orderId: string, status: ServiceOrderStatusEnum): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('UPDATE service_orders SET status = ? WHERE id = ?', status, orderId);
  },

  // Добавляет фото к заявке. Отклонение от §14 `addOrderPhoto(photo)`: в IServiceOrderPhoto нет
  // поля orderId, поэтому он передаётся отдельным аргументом. Caller — Phase 5 (камера), без UI-привязки.
  async addOrderPhoto(orderId: string, photo: IServiceOrderPhoto): Promise<void> {
    const database = await getDatabase();
    await insertPhoto(database, orderId, photo);
  },

  // Удаляет фото заявки: строку БД и физический файл на диске. SELECT + DELETE — в одной
  // withExclusiveTransactionAsync (изоляция от конкурентных запросов того же соединения, см.
  // комментарий getOrders); удаление файла — ПОСЛЕ коммита: при сбое DELETE файл остаётся на месте.
  // mock://-URI сид-фото `deleteFileQuietly` пропускает молча.
  async deleteOrderPhoto(photoId: string): Promise<void> {
    const database = await getDatabase();
    let storedUri: string | null = null;

    await database.withExclusiveTransactionAsync(async (txn) => {
      const row = await txn.getFirstAsync<{ uri: string }>(
        'SELECT uri FROM service_order_photos WHERE id = ?',
        photoId,
      );
      storedUri = row?.uri ?? null;
      await txn.runAsync('DELETE FROM service_order_photos WHERE id = ?', photoId);
    });

    if (storedUri !== null) {
      deleteFileQuietly(toRuntimeUri(storedUri));
    }
  },

  // Полностью очищает обе таблицы и физические файлы фото на диске. SELECT + оба DELETE — в одной
  // withExclusiveTransactionAsync (атомарность и изоляция от конкурентных запросов того же
  // соединения, см. комментарий getOrders); удаление файлов — ПОСЛЕ коммита транзакции: при сбое
  // DELETE файлы остаются на месте и записи в БД не бьются; mock://-URI сид-фото
  // `deleteFileQuietly` пропускает молча. `File.exists`/`delete` синхронные — параллелизм
  // (Promise.all) не нужен, поэтому цикл for..of.
  async clearDatabase(): Promise<void> {
    const database = await getDatabase();
    let photoRows: { uri: string }[] = [];

    await database.withExclusiveTransactionAsync(async (txn) => {
      photoRows = await txn.getAllAsync<{ uri: string }>('SELECT uri FROM service_order_photos');
      await txn.execAsync('DELETE FROM service_order_photos; DELETE FROM service_orders;');
    });

    for (const { uri } of photoRows) {
      deleteFileQuietly(toRuntimeUri(uri));
    }
    logger.info('[orderDatabaseService.clearDatabase] Локальная БД очищена.');
  },
};
