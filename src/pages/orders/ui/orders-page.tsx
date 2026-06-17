import { useRouter } from 'expo-router';
import { type FC, type ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { OrdersSkeletonList } from './orders-skeleton-list';

import { OrderCard, useOrdersStore } from '@/entities/order';
import { getFilteredOrders, OrderStatusFilter } from '@/features/order-filter';
import { OrderSearch } from '@/features/order-search';
import { Spacing } from '@/shared/config';
import { useAppStore } from '@/shared/model';
import { EmptyState, ErrorState, OfflineBanner, Screen, Text } from '@/shared/ui';

// Экран «Заявки»: поиск, фильтр статусов и список карточек. Данные и состояния — из стора (Phase 3).
export const OrdersPage: FC = () => {
  const router = useRouter();
  const { orders, loading, error, filter, search } = useOrdersStore(
    useShallow((state) => ({
      orders: state.orders,
      loading: state.loading,
      error: state.error,
      filter: state.filter,
      search: state.search,
    })),
  );
  const setFilter = useOrdersStore((state) => state.setFilter);
  const setSearch = useOrdersStore((state) => state.setSearch);
  const loadOrders = useOrdersStore((state) => state.loadOrders);
  const offline = useAppStore((state) => state.offline);

  // Производный список считаем чистой функцией от входов стора (решение 4 плана).
  const filteredOrders = useMemo(
    () => getFilteredOrders(orders, filter, search),
    [orders, filter, search],
  );

  const handleOpenOrder = (orderId: string) => {
    router.push({ pathname: '/orders/[orderId]', params: { orderId } });
  };
  const handleRefresh = () => {
    loadOrders();
  };

  const renderBody = (): ReactNode => {
    if (loading) {
      return <OrdersSkeletonList />;
    }

    if (error) {
      return (
        <ErrorState
          title="Не удалось загрузить заявки"
          description="Проверьте подключение и попробуйте снова."
          actionLabel="Повторить"
          onRetry={handleRefresh}
        />
      );
    }

    if (orders.length === 0) {
      return (
        <EmptyState
          icon="list.bullet"
          title="Заявок пока нет"
          description="Новые заявки появятся здесь."
          actionLabel="Обновить"
          actionIcon="arrow.clockwise"
          onAction={handleRefresh}
        />
      );
    }

    if (filteredOrders.length === 0) {
      return (
        <EmptyState
          icon="magnifyingglass"
          title="Ничего не найдено"
          description="Измените запрос или фильтр."
        />
      );
    }

    return (
      <View style={styles.list}>
        <Text size="13" color="textSecondary" style={styles.eyebrow}>
          Сегодня
        </Text>
        {filteredOrders.map((order) => (
          <OrderCard key={order.id} order={order} onPress={() => handleOpenOrder(order.id)} />
        ))}
      </View>
    );
  };

  return (
    <Screen scrollable>
      <View style={styles.content}>
        <Text size="xl" weight="bold">
          Заявки
        </Text>
        <OrderSearch value={search} onChangeText={setSearch} />
        <OrderStatusFilter value={filter} onChange={setFilter} orders={orders} />
        {offline ? <OfflineBanner /> : null}
        {renderBody()}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: Spacing.md,
  },
  list: {
    gap: Spacing.sm,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
