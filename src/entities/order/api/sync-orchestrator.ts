import { syncCycle } from './order-sync-service';

import { logger } from '@/shared/lib/logger';

// Оркестратор синка (PDR client-sync §5/§8, T-08…T-10). Деталь слайса — реэкспортируется только
// через api/index.ts, потребители: useOrdersStore.persistStatus (пинок после мутации) и app-слой
// (триггеры AppState/reconnect, см. _layout.tsx).

// Базовая задержка backoff (мс) и потолок — экспоненциальный рост 2^n * BASE, capped на MAX.
const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 5 * 60 * 1000;

// Раннер, зарегистрированный app-слоем (registerSyncRunner) — обычно useOrdersStore.getState().syncOrders,
// который оборачивает syncCycle гидрацией стора и guard'ами. Цикл импортов store ↔ api предопределён
// (store импортирует ../api, order-sync-service импортирует ../model) — прямой импорт стора отсюда
// углубил бы цикл, поэтому связь идёт через регистрацию (тот же паттерн, что auth-bridge).
let syncRunner: (() => Promise<void>) | null = null;

export const registerSyncRunner = (runner: () => Promise<void>): void => {
  syncRunner = runner;
};

// Модульное состояние single-flight: один прогон одновременно + не более одного отложенного
// повтора (запрошенного во время текущего прогона), не очередь прогонов.
let inFlight: Promise<void> | null = null;
let rerunRequested = false;

// Модульное состояние backoff (R-04): истина — результат запроса, а не факт "сеть недоступна"
// заранее. Успешный цикл сбрасывает счётчик; неудача сдвигает следующую попытку экспоненциально.
let failureCount = 0;
let nextAttemptAt = 0;

const backoffDelayMs = (count: number): number =>
  Math.min(2 ** count * BASE_DELAY_MS, MAX_DELAY_MS);

// Фоллбэк без зарегистрированного раннера (раннер регистрируется app-слоем при старте — сюда можно
// попасть только при вызове requestSync до регистрации, теоретический случай): цикл выполняется, но
// без регидрации стора.
const runSync = async (): Promise<void> => {
  if (!syncRunner) {
    logger.warn(
      '[syncOrchestrator.requestSync] Sync-раннер не зарегистрирован — выполняю syncCycle без регидрации стора.',
    );
    await syncCycle();

    return;
  }
  await syncRunner();
};

/**
 * Запрашивает прогон синка (пинок после локальной мутации, восстановление сети, AppState → active).
 * Single-flight: конкурентный вызов во время уже идущего прогона не стартует новый, а помечает
 * "повторить один раз после завершения". Backoff: вызов раньше nextAttemptAt — no-op (штатный путь
 * при повторных триггерах во время офлайна, не ошибка).
 */
export async function requestSync(): Promise<void> {
  if (inFlight) {
    rerunRequested = true;
    logger.debug(
      '[syncOrchestrator.requestSync] Прогон уже идёт — запрошен повтор после завершения.',
    );

    return inFlight;
  }

  const now = Date.now();
  if (now < nextAttemptAt) {
    logger.debug('[syncOrchestrator.requestSync] Backoff активен — триггер пропущен.', {
      retryInMs: nextAttemptAt - now,
    });

    return;
  }

  inFlight = (async () => {
    try {
      await runSync();
      failureCount = 0;
      nextAttemptAt = 0;
      logger.debug('[syncOrchestrator.requestSync] Прогон завершён успешно.');
    } catch (error) {
      failureCount += 1;
      nextAttemptAt = Date.now() + backoffDelayMs(failureCount);
      logger.debug('[syncOrchestrator.requestSync] Прогон завершился ошибкой — backoff.', {
        failureCount,
        nextAttemptAt,
        error,
      });
    } finally {
      inFlight = null;
      if (rerunRequested) {
        rerunRequested = false;
        void requestSync();
      }
    }
  })();

  return inFlight;
}
