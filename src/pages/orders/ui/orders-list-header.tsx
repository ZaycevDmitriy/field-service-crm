import { memo, type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrderStatusFilter } from '@/features/order-filter';
import { OrderSearch } from '@/features/order-search';
import { Spacing } from '@/shared/config';
import { Text } from '@/shared/ui';

// Закреплённая шапка экрана «Заявки»: заголовок, поиск и фильтр статусов. Рендерится отдельным
// элементом над FlashList (вне прокрутки списка), поэтому не уезжает при скролле карточек. Поиск
// и фильтр самоподписаны на стор; шапка не зависит от пропсов/стора и обёрнута в memo — ввод в
// поиске её не ререндерит, перерисовывается только сам инпут (свод §4.1/§4.9).
const OrdersListHeaderView: FC = () => (
  <View style={styles.header}>
    <Text size="xl" weight="bold">
      Заявки
    </Text>
    <OrderSearch />
    <OrderStatusFilter />
  </View>
);

export const OrdersListHeader = memo(OrdersListHeaderView);

const styles = StyleSheet.create({
  header: {
    // Горизонтальный отступ (Screen у «Заявок» — withPadding={false}); список задаёт свой отдельно.
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    // Зазор до прокручиваемого списка (шапка теперь вне FlashList).
    paddingBottom: Spacing.md,
  },
});
