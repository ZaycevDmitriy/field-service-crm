import { isPullUnassignedItem, MutationVerdictEnum, pullItemToOrder } from '../model';
import type {
  IMutationVerdict,
  IOutboxMutation,
  IPullOrderFields,
  IPullOrdersResponse,
  IPushMutationsResponse,
  IStatusChangeMutation,
} from '../model';

import { orderDatabaseService, SyncStateKeyEnum } from './order-database-service';

import { ApiErrorCodeEnum, httpClient, toApiError } from '@/shared/api';
import { deleteFileQuietly } from '@/shared/lib/fs';
import { logger } from '@/shared/lib/logger';
import { cancelOrderRemindersByKey } from '@/shared/lib/notifications';
import { ToastVariantEnum, useToastStore } from '@/shared/model';

// Лимит страницы pull (бэкенд FR-08: limit ≤ 500). 200 — страница для типового объёма демо/MVP
// (500 изменений при limit=200 → 3 запроса, acceptance-сценарий фазы).
const PAGE_LIMIT = 200;

// Предохранитель от бесконечного цикла при аномалии контракта (nextCursor не растёт, страницы
// всегда полные) — не относится к нормальному объёму MVP, но не должен подвесить приложение.
const MAX_PAGES = 100;

const DEFAULT_CURSOR = 0;

// Лимит батча push (бэкенд: maxItems 500). Полный батч → следующая итерация цикла (см. pushMutations).
const PUSH_BATCH_LIMIT = 500;

// Предохранитель от бесконечного цикла push — тот же принцип, что MAX_PAGES у pull.
const MAX_PUSH_BATCHES = 100;

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
  // Значению из БД не доверяем (та же граница, что resolveOrderStatus): повреждённый курсор дал бы
  // `cursor=NaN` в query на каждый синк (перманентный 400 до wipe) — фоллбэк на 0 безопасен,
  // merge идемпотентен по LWW.
  const parsedCursor = storedCursor === null ? DEFAULT_CURSOR : Number(storedCursor);
  let cursor = Number.isFinite(parsedCursor) ? parsedCursor : DEFAULT_CURSOR;
  logger.debug(`[orderSyncService.pullOrders] Старт: курсор ${cursor}.`);

  for (let pageCount = 1; pageCount <= MAX_PAGES; pageCount += 1) {
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

// Плоская форма мутации на проводе — occurredAt (локальный порядок выгрузки) на сервер не уходит.
const toWireMutation = (mutation: IOutboxMutation): IStatusChangeMutation => ({
  mutationId: mutation.mutationId,
  type: mutation.type,
  orderId: mutation.orderId,
  to: mutation.to,
  baseStatus: mutation.baseStatus,
});

// Разбирает один push-батч вердиктов на resolvedIds (applied/duplicate/rejected — удалить из
// очереди) и конфликтные снимки (пропустить через pullItemToOrder — тот же маппер, что pull, тип
// параметра сужен до Omit<..,'photos'>). Побочные эффекты (тосты/логи) считаются отдельно вызывающим.
const splitPushVerdicts = (
  verdicts: IMutationVerdict[],
  pendingIds: Set<string>,
): {
  resolvedIds: string[];
  conflictSnapshots: { mutationId: string; order: IPullOrderFields }[];
  rejectedCount: number;
  conflictCount: number;
} => {
  const resolvedIds: string[] = [];
  const conflictSnapshots: { mutationId: string; order: IPullOrderFields }[] = [];
  let rejectedCount = 0;
  let conflictCount = 0;

  for (const verdict of verdicts) {
    if (!pendingIds.has(verdict.mutationId)) {
      logger.warn('[orderSyncService.pushMutations] Вердикт с неизвестным mutationId, пропущен.', {
        mutationId: verdict.mutationId,
      });
      continue;
    }

    switch (verdict.result) {
      case MutationVerdictEnum.Applied:
      case MutationVerdictEnum.Duplicate:
        resolvedIds.push(verdict.mutationId);
        break;
      case MutationVerdictEnum.Rejected:
        resolvedIds.push(verdict.mutationId);
        rejectedCount += 1;
        break;
      case MutationVerdictEnum.Conflict: {
        conflictCount += 1;
        const snapshot = verdict.order ? pullItemToOrder(verdict.order) : null;
        if (snapshot) {
          conflictSnapshots.push({ mutationId: verdict.mutationId, order: snapshot });
        } else {
          // Снимок отсутствует или невалиден (маппер вернул null) — мутацию всё равно удаляем
          // (server-authoritative: локальное состояние доедет следующим pull), снимок не применяем.
          logger.warn(
            '[orderSyncService.pushMutations] Конфликтный снимок невалиден или отсутствует, применение пропущено.',
            { mutationId: verdict.mutationId },
          );
          resolvedIds.push(verdict.mutationId);
        }
        break;
      }
      default:
        logger.warn('[orderSyncService.pushMutations] Неизвестный result вердикта, пропущен.', {
          mutationId: verdict.mutationId,
          result: verdict.result,
        });
    }
  }

  return { resolvedIds, conflictSnapshots, rejectedCount, conflictCount };
};

/**
 * Push-цикл outbox-мутаций (PDR client-sync §8, T-08…T-10; бэкенд POST /v1/sync/mutations).
 * Батчами по PUSH_BATCH_LIMIT, хронологический порядок сохранён (getPendingMutations). Удаление из
 * outbox — только после ответа сервера (крэш-безопасность): повтор после крэша вернёт `duplicate`,
 * это штатный путь идемпотентности, не ошибка.
 *
 * Ошибка запроса: инкремент attempts для отправлявшегося батча, лог по коду ошибки (network_error —
 * debug, штатный офлайн; прочее — error, батч отклонён целиком) и проброс наверх — backoff решает
 * оркестратор (sync-orchestrator.ts), очередь здесь не трогается.
 */
export async function pushMutations(): Promise<void> {
  for (let batchCount = 1; batchCount <= MAX_PUSH_BATCHES; batchCount += 1) {
    const pending = await orderDatabaseService.getPendingMutations(PUSH_BATCH_LIMIT);
    if (pending.length === 0) {
      logger.debug('[orderSyncService.pushMutations] Очередь пуста.');

      return;
    }

    logger.debug(
      `[orderSyncService.pushMutations] Батч ${batchCount}: отправляю ${pending.length} мутаций.`,
    );

    let verdicts: IMutationVerdict[];
    try {
      const response = await httpClient.post<IPushMutationsResponse>('/v1/sync/mutations', {
        mutations: pending.map(toWireMutation),
      });
      verdicts = response.data.verdicts;
    } catch (error) {
      await orderDatabaseService.incrementMutationAttempts(pending.map((m) => m.mutationId));
      const apiError = toApiError(error);
      if (apiError.code === ApiErrorCodeEnum.NetworkError) {
        logger.debug('[orderSyncService.pushMutations] Сеть недоступна — очередь не тронута.');
      } else {
        logger.error('[orderSyncService.pushMutations] Батч отклонён сервером.', apiError);
      }
      throw error;
    }

    const pendingIds = new Set(pending.map((m) => m.mutationId));
    const { resolvedIds, conflictSnapshots, rejectedCount, conflictCount } = splitPushVerdicts(
      verdicts,
      pendingIds,
    );

    await orderDatabaseService.applyPushVerdicts(resolvedIds, conflictSnapshots);

    if (rejectedCount > 0) {
      logger.warn(`[orderSyncService.pushMutations] Отклонено сервером: ${rejectedCount}.`);
      useToastStore.getState().showToast(ToastVariantEnum.Info, 'Изменение отклонено сервером');
    }
    if (conflictCount > 0) {
      logger.debug(`[orderSyncService.pushMutations] Конфликтов: ${conflictCount}.`);
      useToastStore.getState().showToast(ToastVariantEnum.Info, 'Заявка обновлена сервером');
    }

    if (pending.length < PUSH_BATCH_LIMIT) {
      logger.debug('[orderSyncService.pushMutations] Финиш: последний батч был неполным.');

      return;
    }
  }

  logger.warn(
    `[orderSyncService.pushMutations] Достигнут предохранитель ${MAX_PUSH_BATCHES} батчей.`,
  );
}

/**
 * Один цикл синхронизации: сначала push (доставить локальные мутации), затем pull (получить
 * серверные изменения, включая те, что применил только что выполненный push). Порядок значим —
 * см. блок «Контракт push» плана фазы. Регидрация стора после цикла — на вызывающем (useOrdersStore).
 */
export async function syncCycle(): Promise<void> {
  await pushMutations();
  await pullOrders();
}
