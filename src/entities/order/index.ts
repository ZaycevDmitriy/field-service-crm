// Публичный API слайса order.
export type {
  IServiceOrder,
  IServiceOrderPhoto,
  IOrdersStore,
  IOrderStatusColor,
  IOrderStatusColors,
} from './model';
export {
  ServiceOrderStatusEnum,
  OrderStatusLabel,
  PhotoSyncStatusEnum,
  OrderFilterEnum,
  OrderFilterLabel,
  useOrdersStore,
  getNearestOrder,
  useOrderDistanceLabel,
  lightOrderStatusColors,
  darkOrderStatusColors,
  useOrderStatusColors,
} from './model';
// Для logout-гибрида pages/settings (T6, решение Q-02 PDR) и app-слоя (T8: регистрация
// sync-раннера + триггеры AppState/reconnect в _layout.tsx) — orderDatabaseService/order-sync-service
// целиком наружу по-прежнему не выносятся, только эти функции.
export { countPendingMutations, pushMutations, registerSyncRunner, requestSync } from './api';
export {
  OrderStatusBadge,
  OrderCard,
  PhotoThumbnail,
  OrderPhotoList,
  type IOrderStatusBadgeProps,
  type IOrderStatusBadgeSize,
  type IOrderCardProps,
  type IPhotoThumbnailProps,
  type IOrderPhotoListProps,
} from './ui';
