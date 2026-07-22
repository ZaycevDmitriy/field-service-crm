import { orderDatabaseService } from '../order-database-service';
import { pullOrders, pushMutations } from '../order-sync-service';
import { ServiceOrderStatusEnum } from '../../model/order-status';
import type { IOutboxMutation, IPullItem } from '../../model/sync-types';

import { httpClient } from '@/shared/api';
import { deleteFileQuietly } from '@/shared/lib/fs';
import { logger } from '@/shared/lib/logger';
import { cancelOrderRemindersByKey } from '@/shared/lib/notifications';
import { useToastStore } from '@/shared/model';

jest.mock('@/shared/api', () => ({
  httpClient: { get: jest.fn(), post: jest.fn() },
  // Мок toApiError, достаточный для pushMutations-тестов: конверт {code,...} — как есть
  // (идемпотентность), прочее (сетевой сбой) — синтетический network_error.
  toApiError: (error: unknown) =>
    error && typeof error === 'object' && 'code' in (error as object)
      ? error
      : { code: 'network_error', message: 'Нет соединения с сервером.' },
  ApiErrorCodeEnum: { NetworkError: 'network_error' },
}));
jest.mock('@/shared/lib/fs', () => ({ deleteFileQuietly: jest.fn() }));
jest.mock('@/shared/lib/notifications', () => ({ cancelOrderRemindersByKey: jest.fn() }));
jest.mock('@/shared/model', () => {
  const mockShowToast = jest.fn();

  return {
    ToastVariantEnum: { Info: 'info', Error: 'error', Success: 'success' },
    useToastStore: { getState: () => ({ showToast: mockShowToast }) },
  };
});
jest.mock('../order-database-service', () => ({
  orderDatabaseService: {
    getSyncStateValue: jest.fn(),
    applyPullPage: jest.fn(),
    getPendingMutations: jest.fn(),
    applyPushVerdicts: jest.fn(),
    incrementMutationAttempts: jest.fn(),
  },
  SyncStateKeyEnum: { Cursor: 'sync.cursor', LastUserId: 'sync.lastUserId' },
}));

const SYNC_ORDERS_URL = '/v1/sync/orders';
const SYNC_MUTATIONS_URL = '/v1/sync/mutations';

const mockedGet = httpClient.get as jest.Mock;
const mockedPost = httpClient.post as jest.Mock;
const mockedGetSyncStateValue = orderDatabaseService.getSyncStateValue as jest.Mock;
const mockedApplyPullPage = orderDatabaseService.applyPullPage as jest.Mock;
const mockedGetPendingMutations = orderDatabaseService.getPendingMutations as jest.Mock;
const mockedApplyPushVerdicts = orderDatabaseService.applyPushVerdicts as jest.Mock;
const mockedIncrementMutationAttempts = orderDatabaseService.incrementMutationAttempts as jest.Mock;
const mockedDeleteFileQuietly = deleteFileQuietly as jest.Mock;
const mockedCancelReminders = cancelOrderRemindersByKey as jest.Mock;
const mockedShowToast = useToastStore.getState().showToast as jest.Mock;

// Общие таймстемпы фикстур — вынесены, чтобы не дублировать литералы (sonarjs/no-duplicate-string),
// переиспользуются и в конфликтных снимках push-тестов ниже.
const RECORD_TIMESTAMP = '2026-01-01T00:00:00.000Z';
const VISIT_TIMESTAMP = '2026-01-02T09:00:00.000Z';
const SLOT_END_TIMESTAMP = '2026-01-02T10:00:00.000Z';
const NETWORK_DOWN_MESSAGE = 'network down';

const BASE_ORDER_PAYLOAD = {
  status: ServiceOrderStatusEnum.New,
  title: 'Заявка',
  client: 'Клиент',
  address: 'Адрес',
  description: '',
  scheduledAt: VISIT_TIMESTAMP,
  slotStart: VISIT_TIMESTAMP,
  slotEnd: SLOT_END_TIMESTAMP,
  latitude: null,
  longitude: null,
  assignedTo: null,
  createdAt: RECORD_TIMESTAMP,
  updatedAt: RECORD_TIMESTAMP,
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
      .mockRejectedValueOnce(new Error(NETWORK_DOWN_MESSAGE));

    await expect(pullOrders()).rejects.toThrow(NETWORK_DOWN_MESSAGE);

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

const makeMutation = (
  mutationId: string,
  overrides: Partial<IOutboxMutation> = {},
): IOutboxMutation => ({
  mutationId,
  type: 'status_change',
  orderId: `order-${mutationId}`,
  to: ServiceOrderStatusEnum.InProgress,
  baseStatus: ServiceOrderStatusEnum.New,
  occurredAt: RECORD_TIMESTAMP,
  ...overrides,
});

// Конфликтный снимок (IConflictOrderSnapshot = Omit<IPullOrderPayload, 'photos'>) — 14 обязательных
// полей, status переопределяется в конкретном тесте (валидный/невалидный).
const makeConflictSnapshot = () => ({
  id: 'order-m1',
  title: 'Заявка',
  client: 'Клиент',
  address: 'Адрес',
  description: '',
  scheduledAt: VISIT_TIMESTAMP,
  slotStart: VISIT_TIMESTAMP,
  slotEnd: SLOT_END_TIMESTAMP,
  latitude: null,
  longitude: null,
  assignedTo: null,
  updatedSeq: 3,
  createdAt: RECORD_TIMESTAMP,
  updatedAt: RECORD_TIMESTAMP,
});

describe('orderSyncService.pushMutations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedApplyPushVerdicts.mockResolvedValue(undefined);
    mockedIncrementMutationAttempts.mockResolvedValue(undefined);
  });

  it('очередь пуста — POST не отправляется', async () => {
    mockedGetPendingMutations.mockResolvedValueOnce([]);

    await pushMutations();

    expect(mockedPost).not.toHaveBeenCalled();
    expect(mockedApplyPushVerdicts).not.toHaveBeenCalled();
  });

  it('батчинг: 501 pending → два POST (500 + 1), хронологический порядок сохранён', async () => {
    const fullBatch = Array.from({ length: 500 }, (_, i) => makeMutation(`m-${i}`));
    const tailBatch = [makeMutation('m-500')];
    mockedGetPendingMutations.mockResolvedValueOnce(fullBatch).mockResolvedValueOnce(tailBatch);
    mockedPost
      .mockResolvedValueOnce({
        data: { verdicts: fullBatch.map((m) => ({ mutationId: m.mutationId, result: 'applied' })) },
      })
      .mockResolvedValueOnce({ data: { verdicts: [{ mutationId: 'm-500', result: 'applied' }] } });

    await pushMutations();

    expect(mockedPost).toHaveBeenCalledTimes(2);
    expect(mockedPost).toHaveBeenNthCalledWith(1, SYNC_MUTATIONS_URL, {
      mutations: fullBatch.map((m) => ({
        mutationId: m.mutationId,
        type: m.type,
        orderId: m.orderId,
        to: m.to,
        baseStatus: m.baseStatus,
      })),
    });
    expect(mockedPost).toHaveBeenNthCalledWith(2, SYNC_MUTATIONS_URL, {
      mutations: [
        {
          mutationId: 'm-500',
          type: tailBatch[0].type,
          orderId: tailBatch[0].orderId,
          to: tailBatch[0].to,
          baseStatus: tailBatch[0].baseStatus,
        },
      ],
    });
  });

  it('applied+duplicate → applyPushVerdicts с их id', async () => {
    mockedGetPendingMutations.mockResolvedValueOnce([makeMutation('m1'), makeMutation('m2')]);
    mockedPost.mockResolvedValueOnce({
      data: {
        verdicts: [
          { mutationId: 'm1', result: 'applied' },
          { mutationId: 'm2', result: 'duplicate' },
        ],
      },
    });

    await pushMutations();

    expect(mockedApplyPushVerdicts).toHaveBeenCalledWith(['m1', 'm2'], []);
  });

  it('conflict → снимок передан, мутация удалена; показан info-тост (один на батч)', async () => {
    mockedGetPendingMutations.mockResolvedValueOnce([makeMutation('m1')]);
    const snapshot = { ...makeConflictSnapshot(), status: ServiceOrderStatusEnum.Cancelled };
    mockedPost.mockResolvedValueOnce({
      data: { verdicts: [{ mutationId: 'm1', result: 'conflict', order: snapshot }] },
    });

    await pushMutations();

    expect(mockedApplyPushVerdicts).toHaveBeenCalledWith(
      [],
      [{ mutationId: 'm1', order: expect.objectContaining({ id: 'order-m1' }) }],
    );
    expect(mockedShowToast).toHaveBeenCalledWith('info', 'Заявка обновлена сервером');
  });

  it('conflict с невалидным статусом снимка (маппер вернул null) — мутация удалена, снимок не применён', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    mockedGetPendingMutations.mockResolvedValueOnce([makeMutation('m1')]);
    mockedPost.mockResolvedValueOnce({
      data: {
        verdicts: [
          {
            mutationId: 'm1',
            result: 'conflict',
            order: { ...makeConflictSnapshot(), status: 'Unknown' },
          },
        ],
      },
    });

    await pushMutations();

    expect(mockedApplyPushVerdicts).toHaveBeenCalledWith(['m1'], []);
  });

  it('rejected → удалена + один info-тост', async () => {
    mockedGetPendingMutations.mockResolvedValueOnce([makeMutation('m1'), makeMutation('m2')]);
    mockedPost.mockResolvedValueOnce({
      data: {
        verdicts: [
          { mutationId: 'm1', result: 'rejected' },
          { mutationId: 'm2', result: 'rejected' },
        ],
      },
    });

    await pushMutations();

    expect(mockedApplyPushVerdicts).toHaveBeenCalledWith(['m1', 'm2'], []);
    expect(mockedShowToast).toHaveBeenCalledTimes(1);
    expect(mockedShowToast).toHaveBeenCalledWith('info', 'Изменение отклонено сервером');
  });

  it('неизвестный result — вердикт пропущен (не резолвится, не конфликт)', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    mockedGetPendingMutations.mockResolvedValueOnce([makeMutation('m1')]);
    mockedPost.mockResolvedValueOnce({
      data: { verdicts: [{ mutationId: 'm1', result: 'unknown-result' }] },
    });

    await pushMutations();

    expect(mockedApplyPushVerdicts).toHaveBeenCalledWith([], []);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('вердикт с неизвестным mutationId — пропущен', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    mockedGetPendingMutations.mockResolvedValueOnce([makeMutation('m1')]);
    mockedPost.mockResolvedValueOnce({
      data: { verdicts: [{ mutationId: 'unknown-id', result: 'applied' }] },
    });

    await pushMutations();

    expect(mockedApplyPushVerdicts).toHaveBeenCalledWith([], []);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('сетевая ошибка — incrementMutationAttempts, очередь не удалена, ошибка проброшена', async () => {
    mockedGetPendingMutations.mockResolvedValueOnce([makeMutation('m1'), makeMutation('m2')]);
    mockedPost.mockRejectedValueOnce(new Error(NETWORK_DOWN_MESSAGE));

    await expect(pushMutations()).rejects.toThrow(NETWORK_DOWN_MESSAGE);

    expect(mockedIncrementMutationAttempts).toHaveBeenCalledWith(['m1', 'm2']);
    expect(mockedApplyPushVerdicts).not.toHaveBeenCalled();
  });

  it('идемпотентность ретрая: POST упал после применения на сервере, повтор → все вердикты duplicate → очередь пуста', async () => {
    const mutations = [makeMutation('m1'), makeMutation('m2')];
    mockedGetPendingMutations.mockResolvedValueOnce(mutations);
    mockedPost.mockRejectedValueOnce(new Error('connection reset'));

    await expect(pushMutations()).rejects.toThrow('connection reset');
    expect(mockedApplyPushVerdicts).not.toHaveBeenCalled();

    // Повтор: outbox не был очищен (первая попытка упала) — те же мутации всё ещё pending.
    mockedGetPendingMutations.mockResolvedValueOnce(mutations);
    mockedPost.mockResolvedValueOnce({
      data: {
        verdicts: [
          { mutationId: 'm1', result: 'duplicate' },
          { mutationId: 'm2', result: 'duplicate' },
        ],
      },
    });

    await pushMutations();

    expect(mockedApplyPushVerdicts).toHaveBeenCalledWith(['m1', 'm2'], []);
  });
});
