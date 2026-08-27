import { buildPullOperations, pullItemToOrder } from '../pull-item-to-order';
import { ServiceOrderStatusEnum } from '../order-status';
import type { IPullItem, IPullOrderPayload } from '../sync-types';

import { logger } from '@/shared/lib/logger';

const VISIT_START = '2026-01-02T09:00:00.000Z';
const VISIT_END = '2026-01-02T10:00:00.000Z';
const RECORD_TIMESTAMP = '2026-01-01T00:00:00.000Z';

const BASE_PAYLOAD: IPullOrderPayload = {
  id: 'order-1',
  status: ServiceOrderStatusEnum.New,
  title: 'Заявка',
  client: 'Клиент',
  address: 'Адрес',
  description: 'Описание',
  scheduledAt: VISIT_START,
  slotStart: VISIT_START,
  slotEnd: VISIT_END,
  latitude: 55.75,
  longitude: 37.61,
  assignedTo: 'user-1',
  updatedSeq: 42,
  createdAt: RECORD_TIMESTAMP,
  updatedAt: RECORD_TIMESTAMP,
  photos: [
    {
      id: 'photo-1',
      orderId: 'order-1',
      authorId: 'user-1',
      status: 'committed',
      comment: null,
      takenAt: '2026-01-01T00:05:00.000Z',
      createdAt: '2026-01-01T00:05:00.000Z',
    },
  ],
};

describe('pullItemToOrder', () => {
  it('round-trip: маппит канонические поля и форматирует отображаемые scheduledTime/scheduledSlot', () => {
    expect(pullItemToOrder(BASE_PAYLOAD)).toEqual({
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
      updatedSeq: 42,
      assignedTo: 'user-1',
      scheduledAt: VISIT_START,
      slotStart: VISIT_START,
      slotEnd: VISIT_END,
      createdAt: RECORD_TIMESTAMP,
      updatedAt: RECORD_TIMESTAMP,
    });
  });

  it('игнорирует метаданные photos из pull-элемента — в результате нет ключа photos', () => {
    expect(pullItemToOrder(BASE_PAYLOAD)).not.toHaveProperty('photos');
  });

  it('null assignedTo → отсутствие ключа assignedTo в домене (заявка не назначена)', () => {
    const order = pullItemToOrder({ ...BASE_PAYLOAD, assignedTo: null });

    expect(order).not.toHaveProperty('assignedTo');
  });

  it('невалидный статус (рассинхрон контракта) → null + logger.warn, элемент пропущен', () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const order = pullItemToOrder({ ...BASE_PAYLOAD, status: 'Unknown' });

    expect(order).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Невалидный статус'),
      expect.objectContaining({ orderId: 'order-1', status: 'Unknown' }),
    );
  });
});

describe('buildPullOperations', () => {
  const orderItem = (id: string, seq: number): IPullItem => ({
    type: 'order',
    seq,
    order: { ...BASE_PAYLOAD, id, updatedSeq: seq },
  });

  const unassignedItem = (orderId: string, seq: number): IPullItem => ({
    type: 'unassigned',
    seq,
    orderId,
  });

  it('сохраняет порядок sync_seq: tombstone и следующий за ним upsert той же заявки', () => {
    const operations = buildPullOperations([unassignedItem('order-1', 1), orderItem('order-1', 2)]);

    expect(operations).toEqual([
      { kind: 'delete', orderId: 'order-1' },
      { kind: 'upsert', order: expect.objectContaining({ id: 'order-1', updatedSeq: 2 }) },
    ]);
  });

  it('элементы вне порядка seq сортируются: порядку канала не доверяем', () => {
    const operations = buildPullOperations([orderItem('order-1', 5), unassignedItem('order-1', 3)]);

    expect(operations.map((operation) => operation.kind)).toEqual(['delete', 'upsert']);
  });

  it('невалидный статус заявки — операция пропускается, tombstone остаётся', () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const invalidItem: IPullItem = {
      type: 'order',
      seq: 2,
      order: { ...BASE_PAYLOAD, id: 'order-bad', updatedSeq: 2, status: 'Unknown' },
    };

    const operations = buildPullOperations([unassignedItem('order-2', 1), invalidItem]);

    expect(operations).toEqual([{ kind: 'delete', orderId: 'order-2' }]);
  });
});
