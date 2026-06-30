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

// Тот же относительный путь, что захардкожен в фабрике jest.mock ниже (DOCUMENT_URI), — для assert-ов.
// Дублирование намеренное: фабрика jest.mock хостится babel-jest над импортами/const, поэтому не может
// замыкать внешние переменные без префикса `mock` (см. конвенцию в updateService.test.ts).
const DOCUMENT_URI = 'file:///mock-document/';

// Минимальный мок expo-file-system: эмулирует File/Paths настолько, чтобы toStoredUri/toRuntimeUri
// и clearDatabase работали с предсказуемым document-каталогом без реального ФС/нативного моста.
jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    exists = true;

    constructor(...args: [{ uri: string }, string] | [string]) {
      this.uri = args.length === 2 ? `${args[0].uri}${args[1]}` : args[0];
    }

    delete(): void {
      this.exists = false;
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

describe('orderDatabaseService.getOrders', () => {
  const mockDatabase = {
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
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
