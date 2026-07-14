// Внутренний barrel сегмента api. Наружу (публичный API слайса, entities/order/index.ts) сервисы
// не выносятся — это деталь реализации; потребитель — только стор слайса (use-orders-store.ts).
export {
  orderDatabaseService,
  SyncStateKeyEnum,
  type IApplyPullPageResult,
} from './order-database-service';
export { pullOrders } from './order-sync-service';
