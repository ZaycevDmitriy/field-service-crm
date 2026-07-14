import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

import { isServiceOrderStatus, ServiceOrderStatusEnum } from '../model/order-status';
import { isPhotoSyncStatus, PhotoSyncStatusEnum } from '../model/photo-sync-status';
import type { IPullOrderFields } from '../model/pull-item-to-order';
import type { IServiceOrder, IServiceOrderPhoto } from '../model/types';

import { getDatabase } from '@/shared/lib/db';
import { deleteFileQuietly } from '@/shared/lib/fs';
import { logger } from '@/shared/lib/logger';

// Database-сервис заявок — деталь реализации слайса (наружу через публичный API не выносится).
// Инкапсулирует expo-sqlite: схему и запросы заявок. Соединение берёт из project-agnostic
// клиента `@/shared/lib/db`. Потребитель — только стор слайса (`useOrdersStore`).
//
// Схема v3 (Phase 11, PDR client-sync §5/T-05): серверные поля заявок (updated_seq, assigned_to,
// scheduled_at, slot_start, slot_end, created_at, updated_at) и синк-поля фото (server_photo_id,
// sync_status, taken_at) — optional в домене до Phase 12 (пока заявки локальные, эти поля заполнит
// первый pull). `latitude`/`longitude` — nullable (сервер допускает заявку без геокодированного
// адреса). Таблицы `sync_outbox`/`sync_state` — только DDL, без CRUD (Phase 12/13). Схема
// версионируется через `PRAGMA user_version`, миграция — вручную в initDatabase (migrateOrdersSchema).
// Цепочка миграций схлопнута: установок v1 в природе нет (существующие — v1.3.0 = схема v2), поэтому
// любой `user_version < 3` ведёт единой миграцией сразу на v3 (без промежуточного v1→v2 шага).

// Версия схемы БД. Поднимать при изменении DDL; миграция выполняется вручную в initDatabase.
const DATABASE_VERSION = 3;

// Row-интерфейсы: представление строк таблиц (snake_case колонки). Маппятся на домен (camelCase).
// export — для unit-теста (см. __tests__/orderDatabaseService.test.ts). Серверные поля v3 — nullable
// в БД (не заполнены до первого pull, Phase 12) — мапперы переводят NULL в отсутствие ключа домена.
export interface IServiceOrderRow {
  id: string;
  status: string;
  title: string;
  client: string;
  address: string;
  description: string;
  scheduled_time: string;
  scheduled_slot: string;
  latitude: number | null;
  longitude: number | null;
  updated_seq: number | null;
  assigned_to: string | null;
  scheduled_at: string | null;
  slot_start: string | null;
  slot_end: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface IServiceOrderPhotoRow {
  id: string;
  order_id: string;
  uri: string;
  comment: string | null;
  created_at: string;
  server_photo_id: string | null;
  sync_status: string;
  taken_at: string | null;
}

// DDL схемы v3: заявки + фото (внешний ключ фото на заявку) + outbox/kv синка. Идемпотентно
// (IF NOT EXISTS) — для свежих установок уже создаёт таблицы в v3-виде, для существующих доводит
// migrateOrdersSchema. `sync_outbox`/`sync_state` — только DDL в этой фазе, без CRUD (Phase 12/13).
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
    latitude REAL,
    longitude REAL,
    updated_seq INTEGER,
    assigned_to TEXT,
    scheduled_at TEXT,
    slot_start TEXT,
    slot_end TEXT,
    created_at TEXT,
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS service_order_photos (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT NOT NULL,
    uri TEXT NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL,
    server_photo_id TEXT,
    sync_status TEXT NOT NULL DEFAULT 'local',
    taken_at TEXT,
    FOREIGN KEY(order_id) REFERENCES service_orders(id)
  );
  CREATE TABLE IF NOT EXISTS sync_outbox (
    mutation_id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    order_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    state TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
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

// Невалидный sync_status (повреждённая строка, ручное редактирование БД) не должен ронять рендер —
// фото остаётся видимым с фоллбэком на Local (тот же паттерн, что resolveOrderStatus ниже, M4).
const resolvePhotoSyncStatus = (rawStatus: string): PhotoSyncStatusEnum => {
  if (isPhotoSyncStatus(rawStatus)) {
    return rawStatus;
  }
  logger.warn('[orderDatabaseService.rowToPhoto] Невалидный sync_status фото, фоллбэк на local.', {
    syncStatus: rawStatus,
  });

  return PhotoSyncStatusEnum.Local;
};

// Мапперы (чистые, типизированные): snake_case строка БД ↔ camelCase домен. NULL серверных
// v3-полей (не заполнены до первого pull, Phase 12) → отсутствие соответствующего ключа домена.
export const rowToPhoto = (row: IServiceOrderPhotoRow): IServiceOrderPhoto => ({
  id: row.id,
  uri: toRuntimeUri(row.uri),
  // `comment` опционален в домене: NULL из БД → отсутствие ключа.
  ...(row.comment !== null ? { comment: row.comment } : {}),
  createdAt: row.created_at,
  ...(row.server_photo_id !== null ? { serverPhotoId: row.server_photo_id } : {}),
  syncStatus: resolvePhotoSyncStatus(row.sync_status),
  ...(row.taken_at !== null ? { takenAt: row.taken_at } : {}),
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
  ...(row.updated_seq !== null ? { updatedSeq: row.updated_seq } : {}),
  ...(row.assigned_to !== null ? { assignedTo: row.assigned_to } : {}),
  ...(row.scheduled_at !== null ? { scheduledAt: row.scheduled_at } : {}),
  ...(row.slot_start !== null ? { slotStart: row.slot_start } : {}),
  ...(row.slot_end !== null ? { slotEnd: row.slot_end } : {}),
  ...(row.created_at !== null ? { createdAt: row.created_at } : {}),
  ...(row.updated_at !== null ? { updatedAt: row.updated_at } : {}),
});

const photoToRow = (orderId: string, photo: IServiceOrderPhoto): IServiceOrderPhotoRow => ({
  id: photo.id,
  order_id: orderId,
  uri: toStoredUri(photo.uri),
  comment: photo.comment ?? null,
  created_at: photo.createdAt,
  server_photo_id: photo.serverPhotoId ?? null,
  sync_status: photo.syncStatus,
  taken_at: photo.takenAt ?? null,
});

// Вставка фото заявки. Только через плейсхолдеры (защита от SQL-инъекции).
const insertPhoto = (
  database: SQLiteDatabase,
  orderId: string,
  photo: IServiceOrderPhoto,
): Promise<SQLiteRunResult> => {
  const row = photoToRow(orderId, photo);

  return database.runAsync(
    `INSERT INTO service_order_photos
       (id, order_id, uri, comment, created_at, server_photo_id, sync_status, taken_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.order_id,
    row.uri,
    row.comment,
    row.created_at,
    row.server_photo_id,
    row.sync_status,
    row.taken_at,
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

// Новые nullable-колонки service_orders в v3 (курсор синка, владелец, канонические серверные
// дата/время — PDR client-sync §5/T-05). ADD COLUMN без NOT NULL: колонка может быть не заполнена
// до первого pull (Phase 12).
const V3_ORDER_COLUMNS: { name: string; ddl: string }[] = [
  { name: 'updated_seq', ddl: 'updated_seq INTEGER' },
  { name: 'assigned_to', ddl: 'assigned_to TEXT' },
  { name: 'scheduled_at', ddl: 'scheduled_at TEXT' },
  { name: 'slot_start', ddl: 'slot_start TEXT' },
  { name: 'slot_end', ddl: 'slot_end TEXT' },
  { name: 'created_at', ddl: 'created_at TEXT' },
  { name: 'updated_at', ddl: 'updated_at TEXT' },
];

// Новые колонки service_order_photos в v3 (двухфазный фото-синк — PDR client-sync §5/T-11).
// sync_status — NOT NULL DEFAULT 'local': ADD COLUMN с DEFAULT допустим и в NOT NULL (в отличие
// от service_orders выше), существующие строки-фото (сняты до Phase 11) получают его безусловно.
const V3_PHOTO_COLUMNS: { name: string; ddl: string }[] = [
  { name: 'server_photo_id', ddl: 'server_photo_id TEXT' },
  { name: 'sync_status', ddl: "sync_status TEXT NOT NULL DEFAULT 'local'" },
  { name: 'taken_at', ddl: 'taken_at TEXT' },
];

// Добавляет колонку в таблицу, только если её ещё нет (интроспекция снаружи, см. table_info) —
// прерванный прошлый прогон мог успеть добавить часть колонок.
const addColumnIfMissing = async (
  database: SQLiteDatabase,
  table: string,
  existingColumns: Set<string>,
  column: { name: string; ddl: string },
): Promise<void> => {
  if (existingColumns.has(column.name)) {
    return;
  }
  logger.debug(`[orderDatabaseService.migrateOrdersSchema] Добавляю колонку ${column.name}.`);
  await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column.ddl};`);
};

// latitude остаётся NOT NULL, только если таблица ещё не мигрирована на v3 — skip-условие
// идемпотентности: свежие установки (CREATE уже nullable) и уже смигрированные существующие
// безопасно пропускают дорогой table rebuild ниже.
const isLatitudeNotNull = async (database: SQLiteDatabase): Promise<boolean> => {
  const columns = await database.getAllAsync<{ name: string; notnull: number }>(
    'PRAGMA table_info(service_orders);',
  );

  return columns.find((column) => column.name === 'latitude')?.notnull === 1;
};

// Снимает NOT NULL с latitude/longitude через 12-step table rebuild (SQLite не умеет ALTER COLUMN
// DROP NOT NULL): новая таблица по v3-DDL → перенос данных → удаление старой → переименование.
// К моменту вызова service_orders уже содержит все v3-колонки (addColumnIfMissing выше отработал
// первым), поэтому SELECT явным списком переносит их без потерь. FK service_order_photos.order_id
// разрешается по ИМЕНИ таблицы в рантайме — после RENAME обратно в service_orders ссылка остаётся
// рабочей без изменений в самой service_order_photos.
//
// ПРЕДПОСЫЛКА (несущая): DROP TABLE service_orders при строках-фото в service_order_photos проходит
// только потому, что на этом соединении FK ВЫКЛЮЧЕНЫ. `PRAGMA foreign_keys = ON` из initDatabase
// действует лишь на основное соединение, а withExclusiveTransactionAsync выполняется на ОТДЕЛЬНОМ
// (Transaction.createAsync в expo-sqlite), где действует дефолт SQLite — OFF. С включёнными FK
// DROP выполняет implicit DELETE всех строк и упал бы с «FOREIGN KEY constraint failed» на любом
// устройстве с фото (данные целы — транзакция откатится, но миграция не завершится никогда).
// Включить FK внутри нельзя: PRAGMA foreign_keys — no-op в открытой транзакции. При смене
// поведения expo-sqlite (FK по умолчанию на новых соединениях) rebuild потребует переработки.
const dropCoordinatesNotNull = async (database: SQLiteDatabase): Promise<void> => {
  logger.debug(
    '[orderDatabaseService.migrateOrdersSchema] Снимаю NOT NULL с latitude/longitude (table rebuild).',
  );
  const columns = [
    'id',
    'status',
    'title',
    'client',
    'address',
    'description',
    'scheduled_time',
    'scheduled_slot',
    'latitude',
    'longitude',
    'updated_seq',
    'assigned_to',
    'scheduled_at',
    'slot_start',
    'slot_end',
    'created_at',
    'updated_at',
  ].join(', ');

  await database.execAsync(`
    CREATE TABLE service_orders_new (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      client TEXT NOT NULL,
      address TEXT NOT NULL,
      description TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      scheduled_slot TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      updated_seq INTEGER,
      assigned_to TEXT,
      scheduled_at TEXT,
      slot_start TEXT,
      slot_end TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    INSERT INTO service_orders_new (${columns}) SELECT ${columns} FROM service_orders;
    DROP TABLE service_orders;
    ALTER TABLE service_orders_new RENAME TO service_orders;
  `);
  logger.debug('[orderDatabaseService.migrateOrdersSchema] Table rebuild завершён.');
};

// Миграция схемы на v3 (Phase 11, PDR client-sync §5/T-05): серверные поля заявок и фото, снятие
// NOT NULL с координат. Цепочка миграций схлопнута (см. комментарий у DATABASE_VERSION выше) —
// любой `user_version < 3` ведёт прямо сюда, промежуточного v1→v2 шага больше нет. Идемпотентна,
// возобновляема и безопасна для свежих установок — каждая операция проверяет фактическую схему
// (интроспекция через PRAGMA table_info) перед изменением. Вызывается ИСКЛЮЧИТЕЛЬНО с транзакционным
// соединением (`txn` из withExclusiveTransactionAsync, см. initDatabase) — kill посреди миграции
// откатывает ВСЕ операции целиком, а не оставляет схему в промежуточном состоянии.
// export — для unit-теста (см. __tests__/orderDatabaseService.test.ts).
export const migrateOrdersSchema = async (database: SQLiteDatabase): Promise<void> => {
  const orderColumns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(service_orders);',
  );
  const orderColumnNames = new Set(orderColumns.map((column) => column.name));

  for (const column of V3_ORDER_COLUMNS) {
    await addColumnIfMissing(database, 'service_orders', orderColumnNames, column);
  }

  // Rebuild — ПОСЛЕ добавления новых колонок выше: явный SELECT-список dropCoordinatesNotNull
  // ссылается на них, они обязаны уже существовать в старой таблице.
  if (await isLatitudeNotNull(database)) {
    await dropCoordinatesNotNull(database);
  }

  const photoColumns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(service_order_photos);',
  );
  const photoColumnNames = new Set(photoColumns.map((column) => column.name));

  for (const column of V3_PHOTO_COLUMNS) {
    await addColumnIfMissing(database, 'service_order_photos', photoColumnNames, column);
  }
};

// Ключи kv-таблицы sync_state (PDR client-sync §5, T-07/T-05): курсор pull и id пользователя
// последнего bootstrap (детекция смены пользователя — см. useOrdersStore.bootstrapSync). Единая
// константа вместо повторения строковых литералов на разных слоях (api + model/store).
export const SyncStateKeyEnum = {
  Cursor: 'sync.cursor',
  LastUserId: 'sync.lastUserId',
} as const;
export type SyncStateKeyEnum = (typeof SyncStateKeyEnum)[keyof typeof SyncStateKeyEnum];

// Upsert одной строки sync_state. Общий хелпер: используется как самостоятельно (setSyncStateValue),
// так и внутри транзакции applyPullPage (курсор персистится в той же транзакции, что и страница).
const upsertSyncStateRow = (
  database: SQLiteDatabase,
  key: string,
  value: string,
): Promise<SQLiteRunResult> =>
  database.runAsync(
    'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );

// UPSERT заявки с LWW-условием: DO UPDATE применяется, только если updated_seq страницы строго
// больше локального (или локальный ещё NULL — заявка получена локально впервые). Условие делает
// merge идемпотентным без предварительного SELECT — повторная поставка safety-lag хвоста (тот же
// updated_seq) — no-op, не затирает локальные данные тем же или более старым снимком.
const upsertOrder = (
  database: SQLiteDatabase,
  order: IPullOrderFields,
): Promise<SQLiteRunResult> => {
  const row: IServiceOrderRow = {
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
    updated_seq: order.updatedSeq,
    assigned_to: order.assignedTo ?? null,
    scheduled_at: order.scheduledAt,
    slot_start: order.slotStart,
    slot_end: order.slotEnd,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };

  return database.runAsync(
    `INSERT INTO service_orders
       (id, status, title, client, address, description, scheduled_time, scheduled_slot,
        latitude, longitude, updated_seq, assigned_to, scheduled_at, slot_start, slot_end,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       title = excluded.title,
       client = excluded.client,
       address = excluded.address,
       description = excluded.description,
       scheduled_time = excluded.scheduled_time,
       scheduled_slot = excluded.scheduled_slot,
       latitude = excluded.latitude,
       longitude = excluded.longitude,
       updated_seq = excluded.updated_seq,
       assigned_to = excluded.assigned_to,
       scheduled_at = excluded.scheduled_at,
       slot_start = excluded.slot_start,
       slot_end = excluded.slot_end,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at
     WHERE excluded.updated_seq > service_orders.updated_seq OR service_orders.updated_seq IS NULL`,
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
    row.updated_seq,
    row.assigned_to,
    row.scheduled_at,
    row.slot_start,
    row.slot_end,
    row.created_at,
    row.updated_at,
  );
};

// Удаляет заявку-tombstone: строки фото (FK на заявку — сначала они), возможные outbox-записи (push
// мутаций — Phase 13, но защита от будущего дребезга уже здесь) и саму заявку. Возвращает уже
// сконвертированные в runtime-URI пути фото — вызывающий (orderSyncService) удаляет файлы, не зная
// о relative/absolute-конвенции хранения (деталь этого модуля, см. toRuntimeUri выше).
const deleteTombstoneOrder = async (
  database: SQLiteDatabase,
  orderId: string,
): Promise<string[]> => {
  const photoRows = await database.getAllAsync<{ uri: string }>(
    'SELECT uri FROM service_order_photos WHERE order_id = ?',
    orderId,
  );
  await database.runAsync('DELETE FROM service_order_photos WHERE order_id = ?', orderId);
  await database.runAsync('DELETE FROM sync_outbox WHERE order_id = ?', orderId);
  await database.runAsync('DELETE FROM service_orders WHERE id = ?', orderId);

  return photoRows.map((row) => toRuntimeUri(row.uri));
};

// Результат применения pull-страницы — вход для post-commit побочных эффектов orderSyncService
// (удаление файлов фото, отмена напоминаний по tombstone-заявкам).
export interface IApplyPullPageResult {
  deletedPhotoUris: string[];
  deletedOrderIds: string[];
}

export const orderDatabaseService = {
  // Создаёт схему, включает foreign keys и применяет миграции по PRAGMA user_version.
  // DDL/PRAGMA создания схемы — через execAsync (bulk, без параметров); CREATE IF NOT EXISTS для
  // свежих установок создаёт таблицы уже в v3-виде, для существующих — no-op (доводит
  // migrateOrdersSchema). Сама миграция выполняется в withExclusiveTransactionAsync на отдельном
  // соединении: ALTER-ы, table rebuild и PRAGMA user_version атомарны — kill в любой момент либо
  // откатывает всё, либо (после коммита) оставляет схему полностью на v3, промежуточных состояний
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

  // Полностью очищает все таблицы (заявки, фото, outbox, sync_state) и физические файлы фото на
  // диске. SELECT + все DELETE — в одной withExclusiveTransactionAsync (атомарность и изоляция от
  // конкурентных запросов того же соединения, см. комментарий getOrders); удаление файлов — ПОСЛЕ
  // коммита транзакции: при сбое DELETE файлы остаются на месте и записи в БД не бьются; mock://-URI
  // сид-фото `deleteFileQuietly` пропускает молча. sync_outbox/sync_state чистятся вместе с
  // заявками (Phase 12): застрявший курсор в sync_state пережил бы очистку и сломал бы повторный
  // bootstrap-pull (сравнение с sync.lastUserId увидело бы «тот же пользователь» и не поставил бы
  // курсор на 0). `File.exists`/`delete` синхронные — параллелизм (Promise.all) не нужен, поэтому
  // цикл for..of.
  async clearDatabase(): Promise<void> {
    const database = await getDatabase();
    let photoRows: { uri: string }[] = [];

    await database.withExclusiveTransactionAsync(async (txn) => {
      photoRows = await txn.getAllAsync<{ uri: string }>('SELECT uri FROM service_order_photos');
      await txn.execAsync(
        'DELETE FROM service_order_photos; DELETE FROM service_orders; DELETE FROM sync_outbox; DELETE FROM sync_state;',
      );
    });

    for (const { uri } of photoRows) {
      deleteFileQuietly(toRuntimeUri(uri));
    }
    logger.info('[orderDatabaseService.clearDatabase] Локальная БД очищена.');
  },

  // Читает значение kv-таблицы sync_state (курсор pull / id пользователя последнего bootstrap).
  // Отсутствие ключа (первый запуск) — null, не ошибка.
  async getSyncStateValue(key: SyncStateKeyEnum): Promise<string | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_state WHERE key = ?',
      key,
    );

    return row?.value ?? null;
  },

  // Пишет значение kv-таблицы sync_state вне транзакции применения страницы (используется
  // bootstrapSync для sync.lastUserId — курсор пишется только внутри applyPullPage, см. ниже).
  async setSyncStateValue(key: SyncStateKeyEnum, value: string): Promise<void> {
    const database = await getDatabase();
    await upsertSyncStateRow(database, key, value);
  },

  // Применяет одну pull-страницу атомарно: LWW-upsert заявок, удаление tombstone-заявок (фото +
  // outbox + сама заявка) и сдвиг курсора — одной withExclusiveTransactionAsync (курсор персистится
  // только вместе с успешным применением страницы, иначе сбой посреди страницы увёл бы курсор вперёд
  // данных). Ошибку не ловим: пробрасываем вызывающему (orderSyncService), который решает, что делать
  // с частично применённым прогоном страниц (курсор уже применённых страниц сохранён — см. task 4).
  // Возвращает URI удалённых фото и id удалённых заявок — вызывающий делает post-commit побочные
  // эффекты (удаление файлов, отмена напоминаний).
  async applyPullPage(
    orders: IPullOrderFields[],
    tombstoneOrderIds: string[],
    nextCursor: number,
  ): Promise<IApplyPullPageResult> {
    const database = await getDatabase();
    const deletedPhotoUris: string[] = [];

    await database.withExclusiveTransactionAsync(async (txn) => {
      for (const order of orders) {
        await upsertOrder(txn, order);
      }
      for (const orderId of tombstoneOrderIds) {
        deletedPhotoUris.push(...(await deleteTombstoneOrder(txn, orderId)));
      }
      await upsertSyncStateRow(txn, SyncStateKeyEnum.Cursor, String(nextCursor));
    });

    logger.debug(
      `[orderDatabaseService.applyPullPage] Страница применена: заявок ${orders.length}, tombstone ${tombstoneOrderIds.length}, курсор → ${nextCursor}.`,
    );

    return { deletedPhotoUris, deletedOrderIds: tombstoneOrderIds };
  },
};
