import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { useOrdersStore } from '@/entities/order';
import { OrderStatusFilter } from '@/features/order-filter';
import { OrderSearch } from '@/features/order-search';
import { Spacing } from '@/shared/config';
import { useAppStore } from '@/shared/model';
import { OfflineBanner, Text } from '@/shared/ui';

// Шапка списка заявок для `ListHeaderComponent` FlashList. Без пропсов и подписана на сторы
// атомарными селекторами — модульная константа стабильна по ссылке, поэтому TextInput поиска
// не перемонтируется на каждый символ и не теряет фокус (свод §4.9, решение F1 плана).
export const OrdersListHeader: FC = () => {
  const search = useOrdersStore((state) => state.search);
  const setSearch = useOrdersStore((state) => state.setSearch);
  const filter = useOrdersStore((state) => state.filter);
  const setFilter = useOrdersStore((state) => state.setFilter);
  const orders = useOrdersStore((state) => state.orders);
  const offline = useAppStore((state) => state.offline);

  return (
    <View style={styles.header}>
      <Text size="xl" weight="bold">
        Заявки
      </Text>
      <OrderSearch value={search} onChangeText={setSearch} />
      <OrderStatusFilter value={filter} onChange={setFilter} orders={orders} />
      {offline ? <OfflineBanner /> : null}
      <Text size="13" color="textSecondary" style={styles.eyebrow}>
        Сегодня
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    gap: Spacing.md,
    // Зазор шапка → первая карточка: ItemSeparatorComponent рендерится только между элементами,
    // не после шапки (решение F5 плана).
    marginBottom: Spacing.sm,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
