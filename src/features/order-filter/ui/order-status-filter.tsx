import { memo, useMemo, type FC } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import {
  OrderFilterEnum,
  OrderFilterLabel,
  ServiceOrderStatusEnum,
  useOrdersStore,
} from '@/entities/order';
import { Spacing } from '@/shared/config';
import { Chip } from '@/shared/ui';

// Порядок чипов фильтра: Все, Новые, В работе, Готово, Отменено.
const FILTERS: OrderFilterEnum[] = [
  OrderFilterEnum.All,
  OrderFilterEnum.New,
  OrderFilterEnum.InProgress,
  OrderFilterEnum.Done,
  OrderFilterEnum.Cancelled,
];

// Горизонтальный фильтр статусов со счётчиками. Счётчики считаются из заявок (совпадают с дизайном 6/2/3/1/0).
const OrderStatusFilterView: FC = () => {
  const value = useOrdersStore((state) => state.filter);
  const setFilter = useOrdersStore((state) => state.setFilter);
  const orders = useOrdersStore((state) => state.orders);

  // Счётчики зависят только от заявок — пересчёт при смене orders, а не при смене фильтра (тап по чипсу).
  const counts = useMemo<Record<OrderFilterEnum, number>>(() => {
    const countByStatus = (status: ServiceOrderStatusEnum): number =>
      orders.filter((order) => order.status === status).length;

    return {
      [OrderFilterEnum.All]: orders.length,
      [OrderFilterEnum.New]: countByStatus(ServiceOrderStatusEnum.New),
      [OrderFilterEnum.InProgress]: countByStatus(ServiceOrderStatusEnum.InProgress),
      [OrderFilterEnum.Done]: countByStatus(ServiceOrderStatusEnum.Done),
      [OrderFilterEnum.Cancelled]: countByStatus(ServiceOrderStatusEnum.Cancelled),
    };
  }, [orders]);

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
          onPress={() => setFilter(filter)}
        />
      ))}
    </ScrollView>
  );
};

// memo: родитель (OrdersListHeader) ререндерится на каждое нажатие в поиске; беспропсовый фильтр
// от этого изолирован и перерисовывается только по своим подпискам (filter/orders) (свод §4.1).
export const OrderStatusFilter = memo(OrderStatusFilterView);

const styles = StyleSheet.create({
  row: {
    gap: Spacing.xs,
  },
});
