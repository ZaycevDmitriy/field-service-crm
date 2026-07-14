import { isPullUnassignedItem, pullItemToOrder } from '../model';
import type { IPullOrderFields, IPullOrdersResponse } from '../model';

import { orderDatabaseService, SyncStateKeyEnum } from './order-database-service';

import { httpClient } from '@/shared/api';
import { deleteFileQuietly } from '@/shared/lib/fs';
import { logger } from '@/shared/lib/logger';
import { cancelOrderRemindersByKey } from '@/shared/lib/notifications';

// Лимит страницы pull (бэкенд FR-08: limit ≤ 500). 200 — страница для типового объёма демо/MVP
// (500 изменений при limit=200 → 3 запроса, acceptance-сценарий фазы).
const PAGE_LIMIT = 200;

// Предохранитель от бесконечного цикла при аномалии контракта (nextCursor не растёт, страницы
// всегда полные) — не относится к нормальному объёму MVP, но не должен подвесить приложение.
const MAX_PAGES = 100;

const DEFAULT_CURSOR = 0;

// Разбирает одну pull-страницу на заявки (уже смаппленные в доменные поля мапером; невалидный
// статус — skip внутри pullItemToOrder) и id заявок-tombstone.
const splitPullItems = (
  items: IPullOrdersResponse['items'],
): { orders: IPullOrderFields[]; tombstoneOrderIds: string[] } => {
  const orders: IPullOrderFields[] = [];
  const tombstoneOrderIds: string[] = [];

  for (const item of items) {
    if (isPullUnassignedItem(item)) {
      tombstoneOrderIds.push(item.orderId);
      continue;
    }
    const order = pullItemToOrder(item.order);
    if (order) {
      orders.push(order);
    }
  }

  return { orders, tombstoneOrderIds };
};

// Post-commit побочные эффекты применённой страницы: удаление файлов фото и отмена напоминаний
// tombstone-заявок. Выполняются ПОСЛЕ коммита транзакции applyPullPage — при сбое транзакции файлы
// и напоминания не тронуты (страница не применилась, откатывать нечего).
const applyPageSideEffects = async (
  deletedPhotoUris: string[],
  deletedOrderIds: string[],
): Promise<void> => {
  for (const uri of deletedPhotoUris) {
    deleteFileQuietly(uri);
  }
  // У tombstone-заявки не должно остаться запланированного напоминания (пара scheduleX/cancelX,
  // PDR-правило API-симметрии) — cancelOrderRemindersByKey безопасна и при отсутствии напоминания.
  await Promise.all(deletedOrderIds.map((orderId) => cancelOrderRemindersByKey(orderId)));
};

/**
 * Курсорный pull заявок техника (PDR client-sync §5, T-07; бэкенд FR-08). Деталь слайса order —
 * реэкспортируется только через api/index.ts (для use-orders-store), в публичный API слайса
 * (entities/order/index.ts) не выносится.
 *
 * Продолжение по `items.length === limit` (поля `hasMore` в контракте нет). Safety-lag сервера
 * штатно пере-отдаёт хвост уже применённых записей — merge (applyPullPage) идемпотентен по LWW,
 * повтор не ошибка. Курсор читается/пишется в sync_state: старт — с последнего сохранённого
 * значения (0, если ключа ещё нет — свежая БД или после wipe при смене пользователя).
 *
 * Ошибка сети/сервера посреди цикла пробрасывается вызывающему: курсор уже применённых страниц
 * сохранён (applyPullPage персистит его в одной транзакции с каждой страницей).
 */
export async function pullOrders(): Promise<void> {
  const storedCursor = await orderDatabaseService.getSyncStateValue(SyncStateKeyEnum.Cursor);
  let cursor = storedCursor === null ? DEFAULT_CURSOR : Number(storedCursor);
  logger.debug(`[orderSyncService.pullOrders] Старт: курсор ${cursor}.`);

  let pageCount = 0;

  for (pageCount = 1; pageCount <= MAX_PAGES; pageCount += 1) {
    const response = await httpClient.get<IPullOrdersResponse>('/v1/sync/orders', {
      params: { cursor, limit: PAGE_LIMIT },
    });
    const { items, nextCursor } = response.data;

    const { orders, tombstoneOrderIds } = splitPullItems(items);
    const { deletedPhotoUris, deletedOrderIds } = await orderDatabaseService.applyPullPage(
      orders,
      tombstoneOrderIds,
      nextCursor,
    );
    await applyPageSideEffects(deletedPhotoUris, deletedOrderIds);

    logger.debug(
      `[orderSyncService.pullOrders] Страница ${pageCount}: элементов ${items.length}, курсор → ${nextCursor}.`,
    );

    cursor = nextCursor;
    if (items.length < PAGE_LIMIT) {
      logger.debug(`[orderSyncService.pullOrders] Финиш: курсор ${cursor}.`);

      return;
    }
  }

  logger.warn(`[orderSyncService.pullOrders] Достигнут предохранитель ${MAX_PAGES} страниц.`);
}
