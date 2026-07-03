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
} from '../orderDatabaseService';

import { MOCK_SERVICE_ORDERS } from '@/entities/order/model/mock';
import { ServiceOrderStatusEnum } from '@/entities/order/model/order-status';
import { getDatabase } from '@/shared/lib/db';

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

describe('rowToPhoto / rowToOrder', () => {
  const photoRow: IServiceOrderPhotoRow = {
    id: 'photo-1',
    order_id: 'order-1',
    uri: 'mock://order-1-photo-1.jpg',
    comment: null,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('rowToPhoto: NULL comment в БД → отсутствие ключа comment в домене', () => {
    expect(rowToPhoto(photoRow)).not.toHaveProperty('comment');
  });

  it('rowToPhoto: непустой comment сохраняется как есть', () => {
    expect(rowToPhoto({ ...photoRow, comment: 'Готово' }).comment).toBe('Готово');
  });

  it('rowToOrder: маппит snake_case строки БД в camelCase домен и прикрепляет фото', () => {
    const row: IServiceOrderRow = {
      id: 'order-1',
      status: ServiceOrderStatusEnum.New,
      title: 'Заявка',
      client: 'Клиент',
      address: 'Адрес',
      description: 'Описание',
      scheduled_time: SCHEDULED_TIME,
      scheduled_slot: SCHEDULED_SLOT,
      latitude: 55.75,
      longitude: 37.61,
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
});

describe('migrateOrdersSchema', () => {
  const makeMockDatabase = (columns: string[]) => ({
    getAllAsync: jest.fn().mockResolvedValue(columns.map((name) => ({ name }))),
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue(undefined),
  });

  it('идемпотентна: latitude уже есть, distance_label отсутствует → ничего не меняет', async () => {
    const database = makeMockDatabase(['id', 'status', 'latitude', 'longitude']);

    await migrateOrdersSchema(database as unknown as SQLiteDatabase);

    expect(database.execAsync).not.toHaveBeenCalled();
    expect(database.runAsync).not.toHaveBeenCalled();
  });

  it('добавляет latitude/longitude и бэкафиллит координаты из MOCK_SERVICE_ORDERS, когда колонок нет', async () => {
    const database = makeMockDatabase(['id', 'status']);

    await migrateOrdersSchema(database as unknown as SQLiteDatabase);

    expect(database.execAsync).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN latitude'));
    expect(database.runAsync).toHaveBeenCalledTimes(MOCK_SERVICE_ORDERS.length);
  });

  it('удаляет distance_label, когда колонка присутствует', async () => {
    const database = makeMockDatabase(['id', 'latitude', 'longitude', 'distance_label']);

    await migrateOrdersSchema(database as unknown as SQLiteDatabase);

    expect(database.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN distance_label'),
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
      title: 'Заявка',
      client: 'Клиент',
      address: 'Адрес',
      description: 'Описание',
      scheduled_time: SCHEDULED_TIME,
      scheduled_slot: SCHEDULED_SLOT,
      latitude: 55.75,
      longitude: 37.61,
    };
    const photoRow: IServiceOrderPhotoRow = {
      id: 'photo-1',
      order_id: 'order-1',
      uri: 'photos/photo-1.jpg',
      comment: null,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    mockDatabase.getAllAsync.mockResolvedValueOnce([orderRow]).mockResolvedValueOnce([photoRow]);

    const orders = await orderDatabaseService.getOrders();

    expect(orders).toHaveLength(1);
    expect(orders[0].photos).toEqual([
      { id: 'photo-1', uri: `${DOCUMENT_URI}photos/photo-1.jpg`, createdAt: photoRow.created_at },
    ]);
  });

  it('заявка без фото получает пустой массив photos', async () => {
    mockDatabase.getAllAsync.mockResolvedValueOnce([
      {
        id: 'order-2',
        status: ServiceOrderStatusEnum.New,
        title: 'Заявка',
        client: 'Клиент',
        address: 'Адрес',
        description: '',
        scheduled_time: SCHEDULED_TIME,
        scheduled_slot: SCHEDULED_SLOT,
        latitude: 55.75,
        longitude: 37.61,
      } satisfies IServiceOrderRow,
    ]);
    mockDatabase.getAllAsync.mockResolvedValueOnce([]);

    const orders = await orderDatabaseService.getOrders();

    expect(orders[0].photos).toEqual([]);
  });
});

describe('orderDatabaseService.clearDatabase', () => {
  const mockDatabase = {
    getAllAsync: jest.fn(),
    execAsync: jest.fn(async () => {
      mockCallOrder.push('execAsync');
    }),
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
