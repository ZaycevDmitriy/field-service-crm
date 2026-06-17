// Публичный API слайса order. UI-сегмент (OrderCard, OrderStatusBadge, …) добавляется в #5.
export type { IServiceOrder, IServiceOrderPhoto } from './model';
export {
  ServiceOrderStatusEnum,
  OrderStatusLabel,
  OrderFilterEnum,
  OrderFilterLabel,
  MOCK_SERVICE_ORDERS,
} from './model';
