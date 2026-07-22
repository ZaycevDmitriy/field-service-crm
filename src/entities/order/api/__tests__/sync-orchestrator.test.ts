// Юнит-тесты оркестратора синка (T5, Phase 13): single-flight (rerunRequested) и backoff (R-04).
// Каждый тест грузит модуль внутри jest.isolateModules — модульные синглтоны (inFlight,
// failureCount, nextAttemptAt, syncRunner) не должны утекать между тестами.
jest.mock('../order-sync-service', () => ({ syncCycle: jest.fn() }));

type IOrchestratorModule = typeof import('../sync-orchestrator');

// Загружает свежий экземпляр оркестратора + мок syncCycle ТОЙ ЖЕ изолированной регистрации модулей
// (иначе require вне isolateModules достал бы инстанс из внешнего реестра — другой jest.fn()).
const loadOrchestrator = (): { orchestrator: IOrchestratorModule; mockedSyncCycle: jest.Mock } => {
  let orchestrator!: IOrchestratorModule;
  let mockedSyncCycle!: jest.Mock;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    orchestrator = require('../sync-orchestrator');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mockedSyncCycle = require('../order-sync-service').syncCycle;
  });

  return { orchestrator, mockedSyncCycle };
};

const flushMicrotasks = async (ticks = 10): Promise<void> => {
  for (let i = 0; i < ticks; i += 1) {
    await Promise.resolve();
  }
};

describe('syncOrchestrator.requestSync', () => {
  it('без зарегистрированного раннера — выполняет syncCycle напрямую (fallback)', async () => {
    const { orchestrator, mockedSyncCycle } = loadOrchestrator();
    mockedSyncCycle.mockResolvedValue(undefined);

    await orchestrator.requestSync();

    expect(mockedSyncCycle).toHaveBeenCalledTimes(1);
  });

  it('registerSyncRunner: requestSync зовёт зарегистрированный раннер, не syncCycle напрямую', async () => {
    const { orchestrator, mockedSyncCycle } = loadOrchestrator();
    const runner = jest.fn().mockResolvedValue(undefined);
    orchestrator.registerSyncRunner(runner);

    await orchestrator.requestSync();

    expect(runner).toHaveBeenCalledTimes(1);
    expect(mockedSyncCycle).not.toHaveBeenCalled();
  });

  it('single-flight: конкурентный вызов во время прогона не стартует новый прогон', async () => {
    const { orchestrator } = loadOrchestrator();
    let resolveRun: () => void = () => undefined;
    const runner = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        }),
    );
    orchestrator.registerSyncRunner(runner);

    const first = orchestrator.requestSync();
    const second = orchestrator.requestSync();

    // Конкурентный вызов не стартовал второй прогон немедленно — раннер вызван один раз (rerun,
    // если он запрошен, стартует только ПОСЛЕ завершения текущего прогона, см. следующий тест).
    expect(runner).toHaveBeenCalledTimes(1);

    resolveRun();
    await first;
    await second;
  });

  it('single-flight: конкурентный вызов помечает один повтор после завершения текущего прогона', async () => {
    const { orchestrator } = loadOrchestrator();
    let resolveRun: () => void = () => undefined;
    const runner = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        }),
    );
    orchestrator.registerSyncRunner(runner);

    const first = orchestrator.requestSync();
    // Конкурентный вызов — не стартует новый прогон, помечает rerunRequested; промис намеренно не
    // ожидается (совпадает с реальным fire-and-forget вызовом из use-orders-store.ts/_layout.tsx).
    orchestrator.requestSync();

    resolveRun();
    await first;
    // Повторный прогон стартует в finally первого — даём микротикам прокрутиться, чтобы он успел
    // вызвать раннер (второй прогон остаётся pending — ждать его завершения не требуется).
    await flushMicrotasks();

    expect(runner).toHaveBeenCalledTimes(2);
  });
});

describe('syncOrchestrator.requestSync — backoff (R-04)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('после неудачи немедленный повторный триггер — no-op (backoff активен)', async () => {
    const { orchestrator } = loadOrchestrator();
    const runner = jest.fn().mockRejectedValueOnce(new Error('network down'));
    orchestrator.registerSyncRunner(runner);

    await orchestrator.requestSync();
    await orchestrator.requestSync();

    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('после истечения backoff — триггер снова зовёт раннер; успех сбрасывает счётчик (следующий триггер не блокируется)', async () => {
    const { orchestrator } = loadOrchestrator();
    const runner = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    orchestrator.registerSyncRunner(runner);

    await orchestrator.requestSync(); // неудача: failureCount=1, nextAttemptAt = now + 10с (2^1*5с)

    jest.setSystemTime(new Date(Date.now() + 15000)); // за пределами паузы для n=1

    await orchestrator.requestSync(); // backoff истёк — раннер вызван, успех сбрасывает счётчик
    await orchestrator.requestSync(); // сразу после успеха — не заблокирован

    expect(runner).toHaveBeenCalledTimes(3);
  });
});
