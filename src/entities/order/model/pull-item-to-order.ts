import { isServiceOrderStatus } from './order-status';
import type { IPullOrderPayload } from './sync-types';
import type { IServiceOrder } from './types';

import { formatScheduledSlot, formatScheduledTime } from '@/shared/lib/date';
import { logger } from '@/shared/lib/logger';

// Поля заявки без photos: pull-контракт Phase 12 не несёт применимых фото (метаданные игнорируются,
// см. sync-types.ts) — фото домена остаются связанными по order_id в локальной БД, apply-слой
// (applyPullPage) трогает только строку service_orders.
export type IPullOrderFields = Omit<IServiceOrder, 'photos'>;

/**
 * Маппит серверный payload pull-элемента заявки в доменные поля (без photos). Канонические
 * scheduledAt/slotStart/slotEnd — источник; scheduledTime/scheduledSlot форматируются на клиенте
 * (shared/lib/date), 1:1 с прежним локальным форматом.
 *
 * Невалидный статус (внешние данные, рассинхрон контракта) → null + logger.warn: элемент
 * пропускается (skip), а не заменяется фоллбэком — в отличие от локальной БД (resolveOrderStatus
 * в order-database-service), здесь это сигнал реального расхождения с сервером, не повреждённая
 * локальная строка.
 */
export const pullItemToOrder = (payload: IPullOrderPayload): IPullOrderFields | null => {
  if (!isServiceOrderStatus(payload.status)) {
    logger.warn('[pullItemToOrder] Невалидный статус заявки в pull-элементе, элемент пропущен.', {
      orderId: payload.id,
      status: payload.status,
    });

    return null;
  }

  return {
    id: payload.id,
    status: payload.status,
    title: payload.title,
    client: payload.client,
    address: payload.address,
    description: payload.description,
    scheduledTime: formatScheduledTime(payload.scheduledAt),
    scheduledSlot: formatScheduledSlot(payload.slotStart, payload.slotEnd),
    latitude: payload.latitude,
    longitude: payload.longitude,
    updatedSeq: payload.updatedSeq,
    ...(payload.assignedTo !== null ? { assignedTo: payload.assignedTo } : {}),
    scheduledAt: payload.scheduledAt,
    slotStart: payload.slotStart,
    slotEnd: payload.slotEnd,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
};
