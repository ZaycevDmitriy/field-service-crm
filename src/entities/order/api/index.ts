// Внутренний barrel сегмента api. Наружу (публичный API слайса, entities/order/index.ts) выносятся
// только countPendingMutations/pushMutations — реэкспорт для logout-гибрида pages/settings (T6,
// см. entities/order/index.ts); остальное — деталь реализации, потребитель — стор слайса
// (use-orders-store.ts) и app-слой (регистрация sync-раннера, _layout.tsx).
import { orderDatabaseService } from './order-database-service';

export {
  orderDatabaseService,
  SyncStateKeyEnum,
  type IApplyPullPageResult,
} from './order-database-service';
export { pushMutations, syncCycle } from './order-sync-service';
export { registerSyncRunner, requestSync } from './sync-orchestrator';

// Обёртка для реэкспорта в публичный API слайса (logout-гибрид, T6) — orderDatabaseService целиком
// наружу не отдаётся.
export const countPendingMutations = (): Promise<number> =>
  orderDatabaseService.countPendingMutations();
