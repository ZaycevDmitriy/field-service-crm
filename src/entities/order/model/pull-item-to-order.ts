import { isServiceOrderStatus } from './order-status';
import { isPullUnassignedItem, type IPullItem, type IPullOrderPayload } from './sync-types';
import type { IServiceOrder } from './types';

import { formatScheduledSlot, formatScheduledTime } from '@/shared/lib/date';
import { logger } from '@/shared/lib/logger';

// Поля заявки без photos: pull-контракт Phase 12 не несёт применимых фото (метаданные игнорируются,
// см. sync-types.ts) — фото домена остаются связанными по order_id в локальной БД, apply-слой
// (applyPullPage) трогает только строку service_orders. Серверные поля здесь ВСЕГДА заполнены
// (в отличие от IServiceOrder, где они optional для локальных заявок до первого pull) — маппер ниже
// заполняет их безусловно из обязательных полей серверного контракта.
export type IPullOrderFields = Omit<IServiceOrder, 'photos'> &
  Required<
    Pick<
      IServiceOrder,
      'updatedSeq' | 'scheduledAt' | 'slotStart' | 'slotEnd' | 'createdAt' | 'updatedAt'
    >
  >;

/**
 * Маппит серверный payload pull-элемента заявки в доменные поля (без photos). Канонические
 * scheduledAt/slotStart/slotEnd — источник; scheduledTime/scheduledSlot форматируются на клиенте
 * (shared/lib/date), 1:1 с прежним локальным форматом.
 *
 * Невалидный статус (внешние данные, рассинхрон контракта) → null + logger.warn: элемент
 * пропускается (skip), а не заменяется фоллбэком — в отличие от локальной БД (resolveOrderStatus
 * в order-database-service), здесь это сигнал реального расхождения с сервером, не повреждённая
 * локальная строка.
 *
 * Параметр — Omit<IPullOrderPayload, 'photos'>: переиспользуется и для конфликтного снимка
 * push-контракта (IConflictOrderSnapshot, Phase 13), который photos не несёт вовсе. Тело маппера
 * это поле не читает — сужение типа не требует изменений ниже.
 */
export const pullItemToOrder = (
  payload: Omit<IPullOrderPayload, 'photos'>,
): IPullOrderFields | null => {
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

/**
 * Операция применения одного pull-элемента к локальной БД: upsert заявки либо удаление
 * (tombstone переназначения). Страница применяется списком операций в порядке `seq` — заявка и её
 * tombstone могут прийти в одной странице (сняли с техника и назначили обратно), и итог зависит
 * от того, какой элемент в потоке `sync_seq` последний.
 */
export type IPullPageOperation =
  | { kind: 'upsert'; order: IPullOrderFields }
  | { kind: 'delete'; orderId: string };

/**
 * Строит операции применения страницы pull, сохраняя порядок общего потока `sync_seq`.
 *
 * Порядок значим: страница может содержать `unassigned(seq N)` и `order(seq N+1)` по одной заявке,
 * и применение «сначала все upsert, потом все tombstone» удалило бы заявку, которую сервер вернул
 * технику. Элементы сортируются по `seq` явно: контракт обещает возрастающий порядок, но данные
 * приходят из сети — на порядок канала не полагаемся (та же граница, что валидация статуса в pullItemToOrder).
 *
 * Невалидный статус заявки — элемент пропускается (см. pullItemToOrder), tombstone-элементы
 * проходят всегда: у них нет полезной нагрузки, которую можно не распознать.
 */
export const buildPullOperations = (items: IPullItem[]): IPullPageOperation[] => {
  const operations: IPullPageOperation[] = [];

  for (const item of [...items].sort((a, b) => a.seq - b.seq)) {
    if (isPullUnassignedItem(item)) {
      operations.push({ kind: 'delete', orderId: item.orderId });
      continue;
    }
    const order = pullItemToOrder(item.order);
    if (order) {
      operations.push({ kind: 'upsert', order });
    }
  }

  return operations;
};
