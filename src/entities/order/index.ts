// Публичный API слайса order.
export type { IServiceOrder, IServiceOrderPhoto } from './model';
export {
  ServiceOrderStatusEnum,
  OrderStatusLabel,
  OrderFilterEnum,
  OrderFilterLabel,
  MOCK_SERVICE_ORDERS,
} from './model';
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
