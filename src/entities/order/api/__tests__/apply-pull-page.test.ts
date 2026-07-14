import type { SQLiteDatabase } from 'expo-sqlite';

import { orderDatabaseService, SyncStateKeyEnum } from '../order-database-service';
import { ServiceOrderStatusEnum } from '../../model/order-status';
import type { IPullOrderFields } from '../../model/pull-item-to-order';

import { getDatabase } from '@/shared/lib/db';

const DOCUMENT_URI = 'file:///mock-document/';

// Тот же минимальный мок expo-file-system, что и в order-database-service.test.ts: эмулирует
// File/Paths достаточно для toRuntimeUri (используется deletedPhotoUris в tombstone-тесте).
jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;

    constructor(...args: [{ uri: string }, string] | [string]) {
      this.uri = args.length === 2 ? `${args[0].uri}${args[1]}` : args[0];
    }
  }

  return {
    Paths: { document: { uri: 'file:///mock-document/' } },
    File: MockFile,
  };
});

jest.mock('@/shared/lib/db', () => ({ getDatabase: jest.fn() }));

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

interface IFakeOrderRow {
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

interface IFakePhotoRow {
  id: string;
  order_id: string;
  uri: string;
}

/**
 * Минимальная in-memory эмуляция SQLite для тех запросов, которые исполняет applyPullPage —
 * включая LWW-условие (INSERT ... ON CONFLICT ... WHERE excluded.updated_seq > ... OR ... IS NULL),
 * чтобы тесты проверяли реальную семантику merge, а не только факт вызова runAsync с ожидаемым SQL.
 */
class FakeDatabase {
  orders = new Map<string, IFakeOrderRow>();
  photos: IFakePhotoRow[] = [];
  outbox: { mutation_id: string; order_id: string }[] = [];
  syncState = new Map<string, string>();

  async withExclusiveTransactionAsync<T>(task: (txn: this) => Promise<T>): Promise<T> {
    return task(this);
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<{ changes: number }> {
    if (sql.startsWith('INSERT INTO service_orders')) {
      const [
        id,
        status,
        title,
        client,
        address,
        description,
        scheduled_time,
        scheduled_slot,
        latitude,
        longitude,
        updated_seq,
        assigned_to,
        scheduled_at,
        slot_start,
        slot_end,
        created_at,
        updated_at,
      ] = params as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        number | null,
        number | null,
        number,
        string | null,
        string,
        string,
        string,
        string,
        string,
      ];
      const row: IFakeOrderRow = {
        id,
        status,
        title,
        client,
        address,
        description,
        scheduled_time,
        scheduled_slot,
        latitude,
        longitude,
        updated_seq,
        assigned_to,
        scheduled_at,
        slot_start,
        slot_end,
        created_at,
        updated_at,
      };
      const existing = this.orders.get(id);
      const shouldApply =
        !existing || existing.updated_seq === null || updated_seq > existing.updated_seq;
      if (shouldApply) {
        this.orders.set(id, row);
      }

      return { changes: shouldApply ? 1 : 0 };
    }
    if (sql.startsWith('DELETE FROM service_order_photos')) {
      const [orderId] = params as [string];
      this.photos = this.photos.filter((photo) => photo.order_id !== orderId);

      return { changes: 1 };
    }
    if (sql.startsWith('DELETE FROM sync_outbox')) {
      const [orderId] = params as [string];
      this.outbox = this.outbox.filter((row) => row.order_id !== orderId);

      return { changes: 1 };
    }
    if (sql.startsWith('DELETE FROM service_orders')) {
      const [id] = params as [string];
      this.orders.delete(id);

      return { changes: 1 };
    }
    if (sql.startsWith('INSERT INTO sync_state')) {
      const [key, value] = params as [string, string];
      this.syncState.set(key, value);

      return { changes: 1 };
    }
    throw new Error(`FakeDatabase.runAsync: незнакомый SQL: ${sql}`);
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    if (sql.startsWith('SELECT uri FROM service_order_photos')) {
      const [orderId] = params as [string];

      return this.photos
        .filter((photo) => photo.order_id === orderId)
        .map((photo) => ({ uri: photo.uri })) as T[];
    }
    throw new Error(`FakeDatabase.getAllAsync: незнакомый SQL: ${sql}`);
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    if (sql.startsWith('SELECT value FROM sync_state')) {
      const [key] = params as [string];
      const value = this.syncState.get(key);

      return value === undefined ? null : ({ value } as T);
    }
    throw new Error(`FakeDatabase.getFirstAsync: незнакомый SQL: ${sql}`);
  }
}

const makeOrder = (overrides: Partial<IPullOrderFields> = {}): IPullOrderFields => ({
  id: 'order-1',
  status: ServiceOrderStatusEnum.New,
  title: 'Заявка',
  client: 'Клиент',
  address: 'Адрес',
  description: 'Описание',
  scheduledTime: '09:00',
  scheduledSlot: '09:00 — 10:00',
  latitude: 55.75,
  longitude: 37.61,
  updatedSeq: 1,
  scheduledAt: '2026-01-02T09:00:00.000Z',
  slotStart: '2026-01-02T09:00:00.000Z',
  slotEnd: '2026-01-02T10:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('orderDatabaseService.applyPullPage', () => {
  let fakeDatabase: FakeDatabase;

  beforeEach(() => {
    fakeDatabase = new FakeDatabase();
    mockedGetDatabase.mockResolvedValue(fakeDatabase as unknown as SQLiteDatabase);
  });

  it('LWW: заявка с большим updatedSeq применяется поверх существующей', async () => {
    await orderDatabaseService.applyPullPage(
      [makeOrder({ updatedSeq: 1, status: ServiceOrderStatusEnum.New })],
      [],
      1,
    );
    await orderDatabaseService.applyPullPage(
      [makeOrder({ updatedSeq: 2, status: ServiceOrderStatusEnum.InProgress })],
      [],
      2,
    );

    expect(fakeDatabase.orders.get('order-1')).toMatchObject({
      status: ServiceOrderStatusEnum.InProgress,
      updated_seq: 2,
    });
  });

  it('LWW: safety-lag replay (тот же updatedSeq) не применяется — идемпотентность мерджа', async () => {
    await orderDatabaseService.applyPullPage(
      [makeOrder({ updatedSeq: 5, status: ServiceOrderStatusEnum.InProgress })],
      [],
      5,
    );
    // Повторная выдача того же хвоста safety-lag: тот же updatedSeq, устаревший статус в payload.
    await orderDatabaseService.applyPullPage(
      [makeOrder({ updatedSeq: 5, status: ServiceOrderStatusEnum.New })],
      [],
      5,
    );

    expect(fakeDatabase.orders.get('order-1')).toMatchObject({
      status: ServiceOrderStatusEnum.InProgress,
      updated_seq: 5,
    });
  });

  it('идемпотентность: повторное применение той же страницы не меняет состояние', async () => {
    const page = [makeOrder({ updatedSeq: 3 })];
    await orderDatabaseService.applyPullPage(page, [], 3);
    const stateAfterFirst = new Map(fakeDatabase.orders);

    await orderDatabaseService.applyPullPage(page, [], 3);

    expect(fakeDatabase.orders).toEqual(stateAfterFirst);
  });

  it('tombstone: удаляет заявку, её фото и outbox-записи; возвращает runtime-URI и id заявки', async () => {
    fakeDatabase.orders.set('order-2', {
      id: 'order-2',
      status: ServiceOrderStatusEnum.New,
      title: 'Заявка',
      client: 'Клиент',
      address: 'Адрес',
      description: '',
      scheduled_time: '09:00',
      scheduled_slot: '09:00 — 10:00',
      latitude: null,
      longitude: null,
      updated_seq: 1,
      assigned_to: 'user-1',
      scheduled_at: null,
      slot_start: null,
      slot_end: null,
      created_at: null,
      updated_at: null,
    });
    fakeDatabase.photos.push({ id: 'photo-1', order_id: 'order-2', uri: 'photos/photo-1.jpg' });
    fakeDatabase.outbox.push({ mutation_id: 'mutation-1', order_id: 'order-2' });

    const result = await orderDatabaseService.applyPullPage([], ['order-2'], 10);

    expect(fakeDatabase.orders.has('order-2')).toBe(false);
    expect(fakeDatabase.photos).toHaveLength(0);
    expect(fakeDatabase.outbox).toHaveLength(0);
    expect(result.deletedOrderIds).toEqual(['order-2']);
    expect(result.deletedPhotoUris).toEqual([`${DOCUMENT_URI}photos/photo-1.jpg`]);
  });

  it('tombstone заявки без локальных фото — deletedPhotoUris пуст, orderId всё равно возвращён', async () => {
    const result = await orderDatabaseService.applyPullPage([], ['order-3'], 11);

    expect(result.deletedPhotoUris).toEqual([]);
    expect(result.deletedOrderIds).toEqual(['order-3']);
  });

  it('курсор персистится в sync_state под ключом SyncStateKeyEnum.Cursor', async () => {
    await orderDatabaseService.applyPullPage([], [], 42);

    expect(fakeDatabase.syncState.get(SyncStateKeyEnum.Cursor)).toBe('42');
  });
});

describe('orderDatabaseService sync state kv', () => {
  let fakeDatabase: FakeDatabase;

  beforeEach(() => {
    fakeDatabase = new FakeDatabase();
    mockedGetDatabase.mockResolvedValue(fakeDatabase as unknown as SQLiteDatabase);
  });

  it('getSyncStateValue: отсутствующий ключ → null', async () => {
    await expect(
      orderDatabaseService.getSyncStateValue(SyncStateKeyEnum.LastUserId),
    ).resolves.toBeNull();
  });

  it('setSyncStateValue/getSyncStateValue: round-trip', async () => {
    await orderDatabaseService.setSyncStateValue(SyncStateKeyEnum.LastUserId, 'user-1');

    await expect(orderDatabaseService.getSyncStateValue(SyncStateKeyEnum.LastUserId)).resolves.toBe(
      'user-1',
    );
  });

  it('setSyncStateValue дважды для одного ключа — перезаписывает значение (upsert)', async () => {
    await orderDatabaseService.setSyncStateValue(SyncStateKeyEnum.LastUserId, 'user-1');
    await orderDatabaseService.setSyncStateValue(SyncStateKeyEnum.LastUserId, 'user-2');

    await expect(orderDatabaseService.getSyncStateValue(SyncStateKeyEnum.LastUserId)).resolves.toBe(
      'user-2',
    );
  });
});
