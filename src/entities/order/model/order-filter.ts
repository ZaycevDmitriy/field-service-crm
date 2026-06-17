// Фильтр списка заявок: «Все» + четыре статуса. Enum-стиль — const-object + производный тип.
export const OrderFilterEnum = {
  All: 'All',
  New: 'New',
  InProgress: 'InProgress',
  Done: 'Done',
  Cancelled: 'Cancelled',
} as const;

export type OrderFilterEnum = (typeof OrderFilterEnum)[keyof typeof OrderFilterEnum];

// Подписи фильтров (дизайн §6): «Новые» во множественном числе, в отличие от статусной «Новая».
export const OrderFilterLabel: Record<OrderFilterEnum, string> = {
  All: 'Все',
  New: 'Новые',
  InProgress: 'В работе',
  Done: 'Готово',
  Cancelled: 'Отменено',
};
