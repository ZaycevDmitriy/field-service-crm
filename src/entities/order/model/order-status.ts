// Статус заявки (PDR §10.5). Enum-стиль — const-object + производный тип, не `enum`.
export const ServiceOrderStatusEnum = {
  New: 'New',
  InProgress: 'InProgress',
  Done: 'Done',
  Cancelled: 'Cancelled',
} as const;

export type ServiceOrderStatusEnum =
  (typeof ServiceOrderStatusEnum)[keyof typeof ServiceOrderStatusEnum];

// Человекочитаемые подписи статусов (PDR §10.5): Done — «Готово» (не дизайновое «Выполнена»).
export const OrderStatusLabel: Record<ServiceOrderStatusEnum, string> = {
  New: 'Новая',
  InProgress: 'В работе',
  Done: 'Готово',
  Cancelled: 'Отменено',
};
