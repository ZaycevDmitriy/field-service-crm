import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useMemo, type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrdersListEmpty } from './orders-list-empty';
import { OrdersListHeader } from './orders-list-header';

import { OrderCard, useOrdersStore, type IServiceOrder } from '@/entities/order';
import { getFilteredOrders } from '@/features/order-filter';
import { Spacing } from '@/shared/config';
import { Screen } from '@/shared/ui';

const keyExtractor = (item: IServiceOrder): string => item.id;
const ItemSeparator: FC = () => <View style={styles.separator} />;
const maintainVisibleContentPosition = { disabled: true } as const;

export const OrdersPage: FC = () => {
  const router = useRouter();
  const orders = useOrdersStore((state) => state.orders);
  const filter = useOrdersStore((state) => state.filter);
  const search = useOrdersStore((state) => state.search);

  // Отзывчивый поиск: ввод мгновенный, пересчёт идёт по «отстающему» значению и прерывается следующим
  // нажатием.
  const deferredSearch = useDeferredValue(search);
  const filteredOrders = useMemo(
    () => getFilteredOrders(orders, filter, deferredSearch),
    [orders, filter, deferredSearch],
  );

  // Стабильный по ссылке колбэк на весь список — id приходит из элемента.
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
        maintainVisibleContentPosition={maintainVisibleContentPosition}
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
