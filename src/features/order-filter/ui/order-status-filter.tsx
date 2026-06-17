import { type FC } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import {
  OrderFilterEnum,
  OrderFilterLabel,
  ServiceOrderStatusEnum,
  type IServiceOrder,
} from '@/entities/order';
import { Spacing } from '@/shared/config';
import { Chip } from '@/shared/ui';

export interface IOrderStatusFilterProps {
  value: OrderFilterEnum;
  onChange: (filter: OrderFilterEnum) => void;
  // Источник счётчиков — заявки из стора (страница всегда передаёт их).
  orders: IServiceOrder[];
}

// Порядок чипов фильтра: Все, Новые, В работе, Готово, Отменено.
const FILTERS: OrderFilterEnum[] = [
  OrderFilterEnum.All,
  OrderFilterEnum.New,
  OrderFilterEnum.InProgress,
  OrderFilterEnum.Done,
  OrderFilterEnum.Cancelled,
];

// Горизонтальный фильтр статусов со счётчиками. Счётчики считаются из заявок (совпадают с дизайном 6/2/3/1/0).
export const OrderStatusFilter: FC<IOrderStatusFilterProps> = ({ value, onChange, orders }) => {
  const countByStatus = (status: ServiceOrderStatusEnum): number =>
    orders.filter((order) => order.status === status).length;

  const counts: Record<OrderFilterEnum, number> = {
    [OrderFilterEnum.All]: orders.length,
    [OrderFilterEnum.New]: countByStatus(ServiceOrderStatusEnum.New),
    [OrderFilterEnum.InProgress]: countByStatus(ServiceOrderStatusEnum.InProgress),
    [OrderFilterEnum.Done]: countByStatus(ServiceOrderStatusEnum.Done),
    [OrderFilterEnum.Cancelled]: countByStatus(ServiceOrderStatusEnum.Cancelled),
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {FILTERS.map((filter) => (
        <Chip
          key={filter}
          label={OrderFilterLabel[filter]}
          count={counts[filter]}
          selected={value === filter}
          onPress={() => onChange(filter)}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: {
    gap: Spacing.xs,
  },
});
