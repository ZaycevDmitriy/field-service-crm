import { orderDatabaseService } from '../order-database-service';
import { pullOrders } from '../order-sync-service';
import { ServiceOrderStatusEnum } from '../../model/order-status';
import type { IPullItem } from '../../model/sync-types';

import { httpClient } from '@/shared/api';
import { deleteFileQuietly } from '@/shared/lib/fs';
import { logger } from '@/shared/lib/logger';
import { cancelOrderRemindersByKey } from '@/shared/lib/notifications';

jest.mock('@/shared/api', () => ({ httpClient: { get: jest.fn() } }));
jest.mock('@/shared/lib/fs', () => ({ deleteFileQuietly: jest.fn() }));
jest.mock('@/shared/lib/notifications', () => ({ cancelOrderRemindersByKey: jest.fn() }));
jest.mock('../order-database-service', () => ({
  orderDatabaseService: {
    getSyncStateValue: jest.fn(),
    applyPullPage: jest.fn(),
  },
  SyncStateKeyEnum: { Cursor: 'sync.cursor', LastUserId: 'sync.lastUserId' },
}));

const SYNC_ORDERS_URL = '/v1/sync/orders';

const mockedGet = httpClient.get as jest.Mock;
const mockedGetSyncStateValue = orderDatabaseService.getSyncStateValue as jest.Mock;
const mockedApplyPullPage = orderDatabaseService.applyPullPage as jest.Mock;
const mockedDeleteFileQuietly = deleteFileQuietly as jest.Mock;
const mockedCancelReminders = cancelOrderRemindersByKey as jest.Mock;

const BASE_ORDER_PAYLOAD = {
  status: ServiceOrderStatusEnum.New,
  title: 'Заявка',
  client: 'Клиент',
  address: 'Адрес',
  description: '',
  scheduledAt: '2026-01-02T09:00:00.000Z',
  slotStart: '2026-01-02T09:00:00.000Z',
  slotEnd: '2026-01-02T10:00:00.000Z',
  latitude: null,
  longitude: null,
  assignedTo: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  photos: [],
};

const makeOrderItem = (id: string, seq: number): IPullItem => ({
  type: 'order',
  seq,
  order: { ...BASE_ORDER_PAYLOAD, id, updatedSeq: seq },
});

const makeTombstoneItem = (orderId: string, seq: number): IPullItem => ({
  type: 'unassigned',
  seq,
  orderId,
});

describe('orderSyncService.pullOrders', () => {
  beforeEach(() => {
    // resetAllMocks (не clearAllMocks): clearAllMocks НЕ чистит очередь mockResolvedValueOnce/
    // mockRejectedValueOnce — недопотреблённые once-значения одного теста утекали бы в следующий.
    jest.resetAllMocks();
    mockedGetSyncStateValue.mockResolvedValue(null);
    mockedApplyPullPage.mockResolvedValue({ deletedPhotoUris: [], deletedOrderIds: [] });
  });

  it('пагинация: 500 изменений при limit=200 → 3 запроса', async () => {
    const page1 = Array.from({ length: 200 }, (_, i) => makeOrderItem(`order-${i}`, i + 1));
    const page2 = Array.from({ length: 200 }, (_, i) => makeOrderItem(`order-${i + 200}`, i + 201));
    const page3 = Array.from({ length: 100 }, (_, i) => makeOrderItem(`order-${i + 400}`, i + 401));

    mockedGet
      .mockResolvedValueOnce({ data: { items: page1, nextCursor: 200 } })
      .mockResolvedValueOnce({ data: { items: page2, nextCursor: 400 } })
      .mockResolvedValueOnce({ data: { items: page3, nextCursor: 500 } });

    await pullOrders();

    expect(mockedGet).toHaveBeenCalledTimes(3);
    expect(mockedGet).toHaveBeenNthCalledWith(1, SYNC_ORDERS_URL, {
      params: { cursor: 0, limit: 200 },
    });
    expect(mockedGet).toHaveBeenNthCalledWith(2, SYNC_ORDERS_URL, {
      params: { cursor: 200, limit: 200 },
    });
    expect(mockedGet).toHaveBeenNthCalledWith(3, SYNC_ORDERS_URL, {
      params: { cursor: 400, limit: 200 },
    });
    expect(mockedApplyPullPage).toHaveBeenCalledTimes(3);
  });

  it('старт с сохранённого курсора sync_state, а не с нуля', async () => {
    mockedGetSyncStateValue.mockResolvedValue('150');
    mockedGet.mockResolvedValueOnce({ data: { items: [], nextCursor: 150 } });

    await pullOrders();

    expect(mockedGet).toHaveBeenCalledWith(SYNC_ORDERS_URL, {
      params: { cursor: 150, limit: 200 },
    });
  });

  it('повреждённый курсор в sync_state (не число) — фоллбэк на 0, NaN в запрос не уходит', async () => {
    mockedGetSyncStateValue.mockResolvedValue('не-число');
    mockedGet.mockResolvedValueOnce({ data: { items: [], nextCursor: 0 } });

    await pullOrders();

    expect(mockedGet).toHaveBeenCalledWith(SYNC_ORDERS_URL, {
      params: { cursor: 0, limit: 200 },
    });
  });

  it('safety-lag: неполная страница (меньше limit) останавливает пагинацию без лишних запросов', async () => {
    const fullPage = Array.from({ length: 200 }, (_, i) => makeOrderItem(`order-${i}`, i + 1));
    const shortPage = [makeOrderItem('order-tail', 250)];

    mockedGet
      .mockResolvedValueOnce({ data: { items: fullPage, nextCursor: 200 } })
      .mockResolvedValueOnce({ data: { items: shortPage, nextCursor: 100 } });

    await pullOrders();

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(mockedApplyPullPage).toHaveBeenCalledTimes(2);
  });

  it('ошибка на 2-й странице пробрасывается; курсор 1-й страницы уже применён', async () => {
    // Страница 1 должна быть ПОЛНОЙ (== limit), иначе pullOrders корректно остановится после неё
    // (неполная страница = конец данных) и до второго запроса дело не дойдёт.
    const fullPage = Array.from({ length: 200 }, (_, i) => makeOrderItem(`order-${i}`, i + 1));
    mockedGet
      .mockResolvedValueOnce({ data: { items: fullPage, nextCursor: 200 } })
      .mockRejectedValueOnce(new Error('network down'));

    await expect(pullOrders()).rejects.toThrow('network down');

    expect(mockedApplyPullPage).toHaveBeenCalledTimes(1);
  });

  it('tombstone-элемент передаётся в applyPullPage отдельно от orders', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { items: [makeTombstoneItem('order-x', 1)], nextCursor: 1 },
    });

    await pullOrders();

    expect(mockedApplyPullPage).toHaveBeenCalledWith([], ['order-x'], 1);
  });

  it('post-commit: удаляет файлы фото и отменяет напоминания по результату applyPullPage', async () => {
    mockedApplyPullPage.mockResolvedValueOnce({
      deletedPhotoUris: ['file:///a.jpg'],
      deletedOrderIds: ['order-x'],
    });
    mockedGet.mockResolvedValueOnce({
      data: { items: [makeTombstoneItem('order-x', 1)], nextCursor: 1 },
    });

    await pullOrders();

    expect(mockedDeleteFileQuietly).toHaveBeenCalledWith('file:///a.jpg');
    expect(mockedCancelReminders).toHaveBeenCalledWith('order-x');
  });

  it('невалидный статус в order-элементе — заявка не попадает в applyPullPage.orders (skip)', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const invalidItem: IPullItem = {
      type: 'order',
      seq: 1,
      order: { ...BASE_ORDER_PAYLOAD, id: 'order-bad', updatedSeq: 1, status: 'Unknown' },
    };
    mockedGet.mockResolvedValueOnce({ data: { items: [invalidItem], nextCursor: 1 } });

    await pullOrders();

    expect(mockedApplyPullPage).toHaveBeenCalledWith([], [], 1);
  });

  it('предохранитель: останавливается после предела страниц и логирует warn', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const fullPage = Array.from({ length: 200 }, (_, i) => makeOrderItem(`o-${i}`, i + 1));
    mockedGet.mockResolvedValue({ data: { items: fullPage, nextCursor: 1 } });

    await pullOrders();

    expect(mockedGet).toHaveBeenCalledTimes(100);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('предохранитель'));
  });
});
