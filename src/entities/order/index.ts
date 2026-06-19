// Публичный API слайса order.
export type { IServiceOrder, IServiceOrderPhoto, IOrdersStore } from './model';
export {
  ServiceOrderStatusEnum,
  OrderStatusLabel,
  OrderFilterEnum,
  OrderFilterLabel,
  useOrdersStore,
  getNearestOrder,
  useOrderDistanceLabel,
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
