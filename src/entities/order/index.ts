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
  OrderFilterEnum,
  OrderFilterLabel,
  useOrdersStore,
  getNearestOrder,
  useOrderDistanceLabel,
  lightOrderStatusColors,
  darkOrderStatusColors,
  useOrderStatusColors,
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
