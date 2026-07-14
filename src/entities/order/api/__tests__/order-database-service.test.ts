import type { SQLiteDatabase } from 'expo-sqlite';

import {
  type IServiceOrderPhotoRow,
  type IServiceOrderRow,
  migrateOrdersSchema,
  orderDatabaseService,
  rowToOrder,
  rowToPhoto,
  toRuntimeUri,
  toStoredUri,
} from '../order-database-service';
import { ServiceOrderStatusEnum } from '../../model/order-status';
import { PhotoSyncStatusEnum } from '../../model/photo-sync-status';

import { getDatabase } from '@/shared/lib/db';
import { logger } from '@/shared/lib/logger';

const DOCUMENT_URI = 'file:///mock-document/';

// URI, для которых был сконструирован File (см. clearDatabase-тесты: mock://-URI File создавать не должен).
const mockFileConstructorCalls: string[] = [];
// Порядок вызовов execAsync/File.delete — для проверки, что clearDatabase удаляет строки БД раньше файлов.
const mockCallOrder: string[] = [];

// Минимальный мок expo-file-system: эмулирует File/Paths настолько, чтобы toStoredUri/toRuntimeUri
// и clearDatabase работали с предсказуемым document-каталогом без реального ФС/нативного моста.
jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    exists = true;

    constructor(...args: [{ uri: string }, string] | [string]) {
      this.uri = args.length === 2 ? `${args[0].uri}${args[1]}` : args[0];
      mockFileConstructorCalls.push(this.uri);
    }

    delete(): void {
      this.exists = false;
      mockCallOrder.push(`delete:${this.uri}`);
    }
  }

  return {
    Paths: { document: { uri: 'file:///mock-document/' } },
    File: MockFile,
  };
});

jest.mock('@/shared/lib/db', () => ({ getDatabase: jest.fn() }));

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

// Используются в обоих describe ниже — вынесены, чтобы не дублировать литералы (sonarjs/no-duplicate-string).
const MOCK_SCHEME_URI = 'mock://order-2-photo-1.jpg';
const EXTERNAL_HTTPS_URI = 'https://example.com/photo.jpg';
const SCHEDULED_TIME = '09:00';
const SCHEDULED_SLOT = '09:00 — 10:00';
const RECORD_TIMESTAMP = '2026-01-01T00:00:00.000Z';
const VISIT_TIMESTAMP = '2026-01-02T09:00:00.000Z';

// Колонки схемы v2 (до Phase 11) и новые v3-колонки (курсор синка, владелец, канонические даты) —
// имена держим отдельно от source-модуля намеренно: V3_ORDER_COLUMNS/V3_PHOTO_COLUMNS там приватные.
const V2_ORDER_COLUMNS = [
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
];
const V3_NEW_ORDER_COLUMNS = [
  'updated_seq',
  'assigned_to',
  'scheduled_at',
  'slot_start',
  'slot_end',
  'created_at',
  'updated_at',
];
const V2_PHOTO_COLUMNS = ['id', 'order_id', 'uri', 'comment', 'created_at'];
const V3_NEW_PHOTO_COLUMNS = ['server_photo_id', 'sync_status', 'taken_at'];

// Базовые (NULL) значения v3-полей заявки/фото — для round-trip тестов мапперов, без повторения
// одних и тех же 7/3 ключей в каждом кейсе.
const BASE_ORDER_ROW: Omit<IServiceOrderRow, 'id' | 'status' | 'latitude' | 'longitude'> = {
  title: 'Заявка',
  client: 'Клиент',
  address: 'Адрес',
  description: 'Описание',
  scheduled_time: SCHEDULED_TIME,
  scheduled_slot: SCHEDULED_SLOT,
  updated_seq: null,
  assigned_to: null,
  scheduled_at: null,
  slot_start: null,
  slot_end: null,
  created_at: null,
  updated_at: null,
};

const BASE_PHOTO_ROW: Omit<
  IServiceOrderPhotoRow,
  'id' | 'order_id' | 'uri' | 'comment' | 'created_at'
> = {
  server_photo_id: null,
  sync_status: PhotoSyncStatusEnum.Local,
  taken_at: null,
};

describe('toStoredUri / toRuntimeUri', () => {
  it('конвертирует абсолютный document-URI в относительный путь и обратно (round-trip)', () => {
    const stored = toStoredUri(`${DOCUMENT_URI}photos/abc.jpg`);

    expect(stored).toBe('photos/abc.jpg');
    expect(toRuntimeUri(stored)).toBe(`${DOCUMENT_URI}photos/abc.jpg`);
  });

  it('toStoredUri не трогает URI вне document-каталога (mock://, http(s)://)', () => {
    expect(toStoredUri(MOCK_SCHEME_URI)).toBe(MOCK_SCHEME_URI);
    expect(toStoredUri(EXTERNAL_HTTPS_URI)).toBe(EXTERNAL_HTTPS_URI);
  });

  it('toRuntimeUri не трогает URI со схемой (внешние/mock — не относительные пути)', () => {
    expect(toRuntimeUri(MOCK_SCHEME_URI)).toBe(MOCK_SCHEME_URI);
    expect(toRuntimeUri(EXTERNAL_HTTPS_URI)).toBe(EXTERNAL_HTTPS_URI);
  });
});

describe('rowToPhoto / rowToOrder — мапперы (round-trip v3)', () => {
  const photoRow: IServiceOrderPhotoRow = {
    id: 'photo-1',
    order_id: 'order-1',
    uri: 'mock://order-1-photo-1.jpg',
    comment: null,
    created_at: RECORD_TIMESTAMP,
    ...BASE_PHOTO_ROW,
  };

  it('rowToPhoto: NULL comment в БД → отсутствие ключа comment в домене', () => {
    expect(rowToPhoto(photoRow)).not.toHaveProperty('comment');
  });

  it('rowToPhoto: непустой comment сохраняется как есть', () => {
    expect(rowToPhoto({ ...photoRow, comment: 'Готово' }).comment).toBe('Готово');
  });

  it('rowToPhoto: NULL server_photo_id/taken_at → отсутствие ключей домена, sync_status маппится как есть', () => {
    const photo = rowToPhoto(photoRow);

    expect(photo).not.toHaveProperty('serverPhotoId');
    expect(photo).not.toHaveProperty('takenAt');
    expect(photo.syncStatus).toBe(PhotoSyncStatusEnum.Local);
  });

  it('rowToPhoto: заполненные server_photo_id/sync_status/taken_at маппятся в домен', () => {
    const photo = rowToPhoto({
      ...photoRow,
      server_photo_id: 'server-photo-1',
      sync_status: PhotoSyncStatusEnum.Staged,
      taken_at: '2026-01-01T00:05:00.000Z',
    });

    expect(photo.serverPhotoId).toBe('server-photo-1');
    expect(photo.syncStatus).toBe(PhotoSyncStatusEnum.Staged);
    expect(photo.takenAt).toBe('2026-01-01T00:05:00.000Z');
  });

  it('rowToPhoto: невалидный sync_status (повреждённая строка) → фоллбэк на local + logger.warn', () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const photo = rowToPhoto({ ...photoRow, sync_status: 'unknown' });

    expect(photo.syncStatus).toBe(PhotoSyncStatusEnum.Local);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Невалидный sync_status'),
      expect.anything(),
    );
  });

  it('rowToOrder: маппит snake_case строки БД в camelCase домен и прикрепляет фото', () => {
    const row: IServiceOrderRow = {
      id: 'order-1',
      status: ServiceOrderStatusEnum.New,
      latitude: 55.75,
      longitude: 37.61,
      ...BASE_ORDER_ROW,
    };

    expect(rowToOrder(row, [rowToPhoto(photoRow)])).toMatchObject({
      id: 'order-1',
      status: ServiceOrderStatusEnum.New,
      scheduledTime: SCHEDULED_TIME,
      scheduledSlot: SCHEDULED_SLOT,
      latitude: 55.75,
      longitude: 37.61,
      photos: [{ id: 'photo-1' }],
    });
  });

  it('rowToOrder: невалидный статус (повреждённая строка) → фоллбэк на New + logger.warn (M4)', () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const row: IServiceOrderRow = {
      id: 'order-1',
      status: 'Unknown',
      latitude: 55.75,
      longitude: 37.61,
      ...BASE_ORDER_ROW,
    };

    expect(rowToOrder(row, []).status).toBe(ServiceOrderStatusEnum.New);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Невалидный статус'),
      expect.anything(),
    );
  });

  it('rowToOrder: NULL серверные v3-поля → отсутствие соответствующих ключей домена', () => {
    const row: IServiceOrderRow = {
      id: 'order-1',
      status: ServiceOrderStatusEnum.New,
      latitude: 55.75,
      longitude: 37.61,
      ...BASE_ORDER_ROW,
    };
    const order = rowToOrder(row, []);

    expect(order).not.toHaveProperty('updatedSeq');
    expect(order).not.toHaveProperty('assignedTo');
    expect(order).not.toHaveProperty('scheduledAt');
    expect(order).not.toHaveProperty('slotStart');
    expect(order).not.toHaveProperty('slotEnd');
    expect(order).not.toHaveProperty('createdAt');
    expect(order).not.toHaveProperty('updatedAt');
  });

  it('rowToOrder: заполненные серверные v3-поля маппятся в домен', () => {
    const row: IServiceOrderRow = {
      id: 'order-1',
      status: ServiceOrderStatusEnum.New,
      latitude: 55.75,
      longitude: 37.61,
      ...BASE_ORDER_ROW,
      updated_seq: 42,
      assigned_to: 'user-1',
      scheduled_at: VISIT_TIMESTAMP,
      slot_start: VISIT_TIMESTAMP,
      slot_end: '2026-01-02T10:00:00.000Z',
      created_at: RECORD_TIMESTAMP,
      updated_at: RECORD_TIMESTAMP,
    };

    expect(rowToOrder(row, [])).toMatchObject({
      updatedSeq: 42,
      assignedTo: 'user-1',
      scheduledAt: VISIT_TIMESTAMP,
      slotStart: VISIT_TIMESTAMP,
      slotEnd: '2026-01-02T10:00:00.000Z',
      createdAt: RECORD_TIMESTAMP,
      updatedAt: RECORD_TIMESTAMP,
    });
  });

  it('rowToOrder: NULL latitude/longitude маппятся как есть (Phase 11 — заявка без координат валидна)', () => {
    const row: IServiceOrderRow = {
      id: 'order-1',
      status: ServiceOrderStatusEnum.New,
      latitude: null,
      longitude: null,
      ...BASE_ORDER_ROW,
    };
    const order = rowToOrder(row, []);

    expect(order.latitude).toBeNull();
    expect(order.longitude).toBeNull();
  });
});

describe('migrateOrdersSchema', () => {
  // sql-роутинг по имени таблицы: PRAGMA table_info(service_orders) вызывается дважды (набор колонок
  // + notnull-проверка latitude), PRAGMA table_info(service_order_photos) — один раз. Один и тот же
  // объект columns переиспользуется для обоих вызовов по service_orders (см. v3OrderColumns ниже).
  const makeMockDatabase = (
    orderColumns: { name: string; notnull: number }[],
    photoColumns: string[] = [...V2_PHOTO_COLUMNS, ...V3_NEW_PHOTO_COLUMNS],
  ) => ({
    getAllAsync: jest.fn((sql: string) =>
      Promise.resolve(
        sql.includes('service_order_photos')
          ? photoColumns.map((name) => ({ name }))
          : orderColumns,
      ),
    ),
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  });

  // Полный набор v3-колонок service_orders; notnullLatitude управляет только колонкой latitude —
  // остальные всегда TEXT/INTEGER NOT NULL исходно и к этой проверке отношения не имеют.
  const v3OrderColumns = (notnullLatitude: number) =>
    [...V2_ORDER_COLUMNS, ...V3_NEW_ORDER_COLUMNS].map((name) => ({
      name,
      notnull: name === 'latitude' ? notnullLatitude : 0,
    }));

  it('полный повтор: все v3-колонки уже есть, координаты уже nullable → ни ALTER, ни rebuild, ни backfill', async () => {
    const database = makeMockDatabase(v3OrderColumns(0));

    await migrateOrdersSchema(database as unknown as SQLiteDatabase);

    expect(database.execAsync).not.toHaveBeenCalled();
    expect(database.runAsync).not.toHaveBeenCalled();
  });

  it('добавляет 7 новых nullable-колонок service_orders, когда их нет (координаты уже nullable)', async () => {
    const database = makeMockDatabase(V2_ORDER_COLUMNS.map((name) => ({ name, notnull: 0 })));

    await migrateOrdersSchema(database as unknown as SQLiteDatabase);

    for (const column of V3_NEW_ORDER_COLUMNS) {
      expect(database.execAsync).toHaveBeenCalledWith(
        expect.stringContaining(`ADD COLUMN ${column}`),
      );
    }
    expect(database.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('service_orders_new'),
    );
  });

  it('частичное состояние: часть новых колонок service_orders уже добавлена → добавляет только отсутствующие', async () => {
    const database = makeMockDatabase(
      [...V2_ORDER_COLUMNS, 'updated_seq', 'assigned_to'].map((name) => ({ name, notnull: 0 })),
    );

    await migrateOrdersSchema(database as unknown as SQLiteDatabase);

    expect(database.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN updated_seq'),
    );
    expect(database.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN assigned_to'),
    );
    expect(database.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN scheduled_at'),
    );
    expect(database.execAsync).toHaveBeenCalledTimes(5);
  });

  it('снимает NOT NULL с latitude/longitude через table rebuild, если колонка ещё NOT NULL (legacy v2)', async () => {
    const database = makeMockDatabase(
      V2_ORDER_COLUMNS.map((name) => ({ name, notnull: name === 'latitude' ? 1 : 0 })),
    );

    await migrateOrdersSchema(database as unknown as SQLiteDatabase);

    const rebuildSql = database.execAsync.mock.calls
      .map((call) => String(call[0]))
      .find((sql) => sql.includes('service_orders_new'));

    expect(rebuildSql).toBeDefined();
    expect(rebuildSql).toContain('CREATE TABLE service_orders_new');
    expect(rebuildSql).toContain('INSERT INTO service_orders_new');
    expect(rebuildSql).toContain('DROP TABLE service_orders;');
    expect(rebuildSql).toContain('ALTER TABLE service_orders_new RENAME TO service_orders;');
    // Миграция v3 не бэкафиллит данные из сида — mock.ts и backfill-логика удалены вместе с ним (Phase 11).
    expect(database.runAsync).not.toHaveBeenCalled();
  });

  it('пропускает table rebuild, если latitude уже nullable (notnull=0) — идемпотентность повторного прогона', async () => {
    const database = makeMockDatabase(v3OrderColumns(0));

    await migrateOrdersSchema(database as unknown as SQLiteDatabase);

    expect(database.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('service_orders_new'),
    );
  });

  it('добавляет server_photo_id/sync_status/taken_at к service_order_photos, когда их нет', async () => {
    const database = makeMockDatabase(v3OrderColumns(0), V2_PHOTO_COLUMNS);

    await migrateOrdersSchema(database as unknown as SQLiteDatabase);

    expect(database.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN server_photo_id'),
    );
    expect(database.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'local'"),
    );
    expect(database.execAsync).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN taken_at'));
  });

  it('не трогает service_order_photos, если все новые колонки уже есть', async () => {
    const database = makeMockDatabase(v3OrderColumns(0), [
      ...V2_PHOTO_COLUMNS,
      ...V3_NEW_PHOTO_COLUMNS,
    ]);

    await migrateOrdersSchema(database as unknown as SQLiteDatabase);

    expect(database.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('service_order_photos ADD COLUMN'),
    );
  });
});

interface IMockGetOrdersDatabase {
  execAsync: jest.Mock;
  runAsync: jest.Mock;
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  withExclusiveTransactionAsync: jest.Mock;
}

describe('orderDatabaseService.initDatabase', () => {
  // Тот же самореференсный паттерн, что в getOrders: withExclusiveTransactionAsync вызывает
  // колбэк с тем же mock-объектом (txn === database), поэтому execAsync/getAllAsync внутри
  // миграции и снаружи (SCHEMA_SQL) считаются одним и тем же jest.fn().
  const mockDatabase: IMockGetOrdersDatabase = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    withExclusiveTransactionAsync: jest.fn(async (task: (txn: unknown) => Promise<void>) =>
      task(mockDatabase),
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.execAsync.mockResolvedValue(undefined);
    mockDatabase.runAsync.mockResolvedValue({ changes: 1 });
    // Пустой набор колонок для любого PRAGMA table_info — migrateOrdersSchema добавит все ALTER'ы;
    // эти тесты проверяют оркестрацию initDatabase, а не саму логику миграции (см. describe выше).
    mockDatabase.getAllAsync.mockResolvedValue([]);
    mockedGetDatabase.mockResolvedValue(mockDatabase as unknown as SQLiteDatabase);
  });

  it('версия схемы устарела → миграция и PRAGMA user_version=3 выполняются внутри withExclusiveTransactionAsync (через txn)', async () => {
    mockDatabase.getFirstAsync.mockResolvedValueOnce({ user_version: 2 });

    await orderDatabaseService.initDatabase();

    expect(mockDatabase.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('PRAGMA user_version = 3'),
    );
  });

  it('версия схемы актуальна → withExclusiveTransactionAsync не вызывается (нет лишней транзакции)', async () => {
    mockDatabase.getFirstAsync.mockResolvedValueOnce({ user_version: 3 });

    await orderDatabaseService.initDatabase();

    expect(mockDatabase.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('SCHEMA_SQL создаёт таблицы sync_outbox и sync_state (DDL-заготовка синка, Phase 12/13)', async () => {
    mockDatabase.getFirstAsync.mockResolvedValueOnce({ user_version: 3 });

    await orderDatabaseService.initDatabase();

    const schemaCall = mockDatabase.execAsync.mock.calls
      .map((call) => String(call[0]))
      .find((sql) => sql.includes('CREATE TABLE'));

    expect(schemaCall).toContain('CREATE TABLE IF NOT EXISTS sync_outbox');
    expect(schemaCall).toContain('CREATE TABLE IF NOT EXISTS sync_state');
  });
});

describe('orderDatabaseService.getOrders', () => {
  // Явная аннотация типа: колбэк withExclusiveTransactionAsync замыкает mockDatabase на себя же
  // (txn — тот же объект, что и database), без типа TS не выводит тип в самореференсной инициализации.
  const mockDatabase: IMockGetOrdersDatabase = {
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    withExclusiveTransactionAsync: jest.fn(async (task: (txn: unknown) => Promise<void>) =>
      task(mockDatabase),
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDatabase.mockResolvedValue(mockDatabase as unknown as SQLiteDatabase);
  });

  it('группирует фото по заявке и конвертирует относительный uri в абсолютный', async () => {
    const orderRow: IServiceOrderRow = {
      id: 'order-1',
      status: ServiceOrderStatusEnum.New,
      latitude: 55.75,
      longitude: 37.61,
      ...BASE_ORDER_ROW,
    };
    const photoRow: IServiceOrderPhotoRow = {
      id: 'photo-1',
      order_id: 'order-1',
      uri: 'photos/photo-1.jpg',
      comment: null,
      created_at: RECORD_TIMESTAMP,
      ...BASE_PHOTO_ROW,
    };
    mockDatabase.getAllAsync.mockResolvedValueOnce([orderRow]).mockResolvedValueOnce([photoRow]);

    const orders = await orderDatabaseService.getOrders();

    expect(orders).toHaveLength(1);
    expect(orders[0].photos).toEqual([
      {
        id: 'photo-1',
        uri: `${DOCUMENT_URI}photos/photo-1.jpg`,
        createdAt: photoRow.created_at,
        syncStatus: PhotoSyncStatusEnum.Local,
      },
    ]);
  });

  it('заявка без фото получает пустой массив photos', async () => {
    mockDatabase.getAllAsync.mockResolvedValueOnce([
      {
        id: 'order-2',
        status: ServiceOrderStatusEnum.New,
        latitude: 55.75,
        longitude: 37.61,
        ...BASE_ORDER_ROW,
      } satisfies IServiceOrderRow,
    ]);
    mockDatabase.getAllAsync.mockResolvedValueOnce([]);

    const orders = await orderDatabaseService.getOrders();

    expect(orders[0].photos).toEqual([]);
  });

  it('заявка с NULL координатами маппится с latitude/longitude = null (Phase 11)', async () => {
    mockDatabase.getAllAsync.mockResolvedValueOnce([
      {
        id: 'order-3',
        status: ServiceOrderStatusEnum.New,
        latitude: null,
        longitude: null,
        ...BASE_ORDER_ROW,
      } satisfies IServiceOrderRow,
    ]);
    mockDatabase.getAllAsync.mockResolvedValueOnce([]);

    const orders = await orderDatabaseService.getOrders();

    expect(orders[0].latitude).toBeNull();
    expect(orders[0].longitude).toBeNull();
  });
});

interface IMockClearDatabase {
  getAllAsync: jest.Mock;
  execAsync: jest.Mock;
  withExclusiveTransactionAsync: jest.Mock;
}

describe('orderDatabaseService.clearDatabase', () => {
  // Тот же самореференсный паттерн, что в getOrders/migrateOrdersSchema: withExclusiveTransactionAsync
  // вызывает колбэк с txn = сам mockDatabase, поэтому getAllAsync/execAsync внутри него видны напрямую.
  const mockDatabase: IMockClearDatabase = {
    getAllAsync: jest.fn(),
    execAsync: jest.fn(async () => {
      mockCallOrder.push('execAsync');
    }),
    withExclusiveTransactionAsync: jest.fn(async (task: (txn: unknown) => Promise<void>) =>
      task(mockDatabase),
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileConstructorCalls.length = 0;
    mockCallOrder.length = 0;
    mockedGetDatabase.mockResolvedValue(mockDatabase as unknown as SQLiteDatabase);
  });

  it('удаляет строки (DELETE) раньше файлов фото на диске', async () => {
    mockDatabase.getAllAsync.mockResolvedValueOnce([{ uri: 'photos/photo-1.jpg' }]);

    await orderDatabaseService.clearDatabase();

    expect(mockCallOrder).toEqual(['execAsync', `delete:${DOCUMENT_URI}photos/photo-1.jpg`]);
  });

  it('для mock://-URI сид-фото File не конструируется (нет исключений/ложных логов)', async () => {
    mockDatabase.getAllAsync.mockResolvedValueOnce([{ uri: MOCK_SCHEME_URI }]);

    await orderDatabaseService.clearDatabase();

    expect(mockFileConstructorCalls).toHaveLength(0);
  });

  it('удаляет file://-URI фото на диске', async () => {
    mockDatabase.getAllAsync.mockResolvedValueOnce([{ uri: 'photos/photo-2.jpg' }]);

    await orderDatabaseService.clearDatabase();

    expect(mockCallOrder).toContain(`delete:${DOCUMENT_URI}photos/photo-2.jpg`);
  });
});
