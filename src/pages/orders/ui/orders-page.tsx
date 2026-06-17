import { useRouter } from 'expo-router';
import { type FC, type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrdersDevStateSwitcher, type OrdersViewState } from './orders-dev-state-switcher';
import { OrdersSkeletonList } from './orders-skeleton-list';

import { MOCK_SERVICE_ORDERS, OrderCard, OrderFilterEnum } from '@/entities/order';
import { OrderStatusFilter } from '@/features/order-filter';
import { OrderSearch } from '@/features/order-search';
import { Spacing } from '@/shared/config';
import { EmptyState, OfflineBanner, Screen, Text } from '@/shared/ui';

// Экран «Заявки»: поиск, фильтр статусов и список карточек со всеми состояниями.
// Фильтрация/поиск — логика Phase 3; в Phase 2 список статичен (все mock-заявки).
export const OrdersPage: FC = () => {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<OrderFilterEnum>(OrderFilterEnum.All);
  // DEV: состояние экрана через переключатель (удаляется в Phase 3).
  const [devState, setDevState] = useState<OrdersViewState>('content');

  const handleOpenOrder = (orderId: string) => {
    router.push({ pathname: '/orders/[orderId]', params: { orderId } });
  };
  // Обновление списка — Phase 3 (реальные данные). Пока no-op.
  const handleRefresh = () => undefined;

  const renderBody = (): ReactNode => {
    if (devState === 'loading') {
      return <OrdersSkeletonList />;
    }

    if (devState === 'empty') {
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

    return (
      <View style={styles.list}>
        <Text size="13" color="textSecondary" style={styles.eyebrow}>
          Сегодня
        </Text>
        {MOCK_SERVICE_ORDERS.map((order) => (
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
        <OrdersDevStateSwitcher value={devState} onChange={setDevState} />
        <OrderSearch value={search} onChangeText={setSearch} />
        <OrderStatusFilter value={filter} onChange={setFilter} />
        {devState === 'offline' ? <OfflineBanner /> : null}
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
