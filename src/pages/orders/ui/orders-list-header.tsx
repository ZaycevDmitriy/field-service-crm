import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { useOrdersStore } from '@/entities/order';
import { OrderStatusFilter } from '@/features/order-filter';
import { OrderSearch } from '@/features/order-search';
import { Spacing } from '@/shared/config';
import { useAppStore } from '@/shared/model';
import { OfflineBanner, Text } from '@/shared/ui';

// Закреплённая шапка экрана «Заявки»: заголовок, поиск и фильтр статусов. Рендерится отдельным
// элементом над FlashList (вне прокрутки списка), поэтому не уезжает при скролле карточек. Как
// позиционный дочерний элемент OrdersPage не перемонтируется при ререндере — TextInput поиска
// не теряет фокус (свод §4.9).
export const OrdersListHeader: FC = () => {
  const search = useOrdersStore((state) => state.search);
  const setSearch = useOrdersStore((state) => state.setSearch);

  const offline = useAppStore((state) => state.offline);

  return (
    <View style={styles.header}>
      <Text size="xl" weight="bold">
        Заявки
      </Text>
      <OrderSearch value={search} onChangeText={setSearch} />
      <OrderStatusFilter />
      {offline ? <OfflineBanner /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    // Горизонтальный отступ (Screen у «Заявок» — withPadding={false}); список задаёт свой отдельно.
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    // Зазор до прокручиваемого списка (шапка теперь вне FlashList).
    paddingBottom: Spacing.md,
  },
});
