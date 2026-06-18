import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { type FC, useCallback, useDeferredValue, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrdersListEmpty } from './orders-list-empty';
import { OrdersListHeader } from './orders-list-header';

import { OrderCard, useOrdersStore, type IServiceOrder } from '@/entities/order';
import { getFilteredOrders } from '@/features/order-filter';
import { Spacing } from '@/shared/config';
import { Screen } from '@/shared/ui';

// Стабильный keyExtractor — модульная константа, не замыкает пропсы (свод §4.2/§4.5).
const keyExtractor = (item: IServiceOrder): string => item.id;

// Разделитель карточек: FlashList не поддерживает `gap`, межэлементный зазор задаём сепаратором
// (после шапки не рендерится — зазор шапка→первая карточка живёт в OrdersListHeader, F5).
const ItemSeparator: FC = () => <View style={styles.separator} />;

// Экран «Заявки»: виртуализированный список (FlashList v2). Шапка (поиск/фильтр) и состояния вынесены
// в стабильные store-subscribed компоненты, элемент — memo: список держит 500–1000 заявок без фриза
// (свод docs/performance-lists-memoization.md).
export const OrdersPage: FC = () => {
  const router = useRouter();
  const orders = useOrdersStore((state) => state.orders);
  const filter = useOrdersStore((state) => state.filter);
  const search = useOrdersStore((state) => state.search);

  // Отзывчивый поиск: ввод мгновенный, пересчёт идёт по «отстающему» значению и прерывается следующим
  // нажатием (эффективно только при memo-элементе OrderCard, свод §10).
  const deferredSearch = useDeferredValue(search);
  const filteredOrders = useMemo(
    () => getFilteredOrders(orders, filter, deferredSearch),
    [orders, filter, deferredSearch],
  );

  // Стабильный по ссылке колбэк на весь список — id приходит из элемента (свод §4.3).
  const handleOpenOrder = useCallback(
    (orderId: string) => {
      router.push({ pathname: '/orders/[orderId]', params: { orderId } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: IServiceOrder }) => <OrderCard order={item} onPress={handleOpenOrder} />,
    [handleOpenOrder],
  );

  return (
    <Screen scrollable={false} withPadding={false}>
      <FlashList
        data={filteredOrders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={OrdersListHeader}
        ListEmptyComponent={OrdersListEmpty}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  listContent: {
    // Горизонтальный отступ контента (Screen withPadding={false}); верх/низ safe-area даёт Screen.
    paddingHorizontal: Spacing.md,
  },
  separator: {
    height: Spacing.sm,
  },
});
