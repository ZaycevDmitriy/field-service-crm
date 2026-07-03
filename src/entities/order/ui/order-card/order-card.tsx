import { type FC, memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useOrderDistanceLabel, useOrderStatusColors, type IServiceOrder } from '../../model';
import { OrderStatusBadge } from '../order-status-badge';

import { Radius, Shadows, Spacing, useColors } from '@/shared/config';
import { IconSymbol, Text } from '@/shared/ui';

export interface IOrderCardProps {
  order: IServiceOrder;
  // Колбэк принимает id и вызывается внутри элемента — родитель передаёт один стабильный useCallback
  // на весь список (без `() => fn(order.id)` на каждый элемент), иначе memo холостой (свод §4.3).
  onPress: (orderId: string) => void;
}

// Карточка заявки в списке: левый рейл цвета статуса, время+дистанция и StatusBadge, заголовок, адрес+клиент.
const OrderCardComponent: FC<IOrderCardProps> = ({ order, onPress }) => {
  const colors = useColors();
  const statusColors = useOrderStatusColors();
  const railColor = statusColors[order.status].text;
  // Дистанция — производное от текущей локации; null → сегмент скрыт (локация недоступна).
  const distanceLabel = useOrderDistanceLabel(order);

  return (
    <Pressable
      onPress={() => onPress(order.id)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Левый рейл 3px цвета статуса — декоративная stroke-ширина (вне spacing-шкалы). */}
      <View style={[styles.rail, { backgroundColor: railColor }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.timeWrap}>
            <Text size="17" weight="bold" style={styles.tabular}>
              {order.scheduledTime}
            </Text>
            {distanceLabel ? (
              <Text size="13" color="textSecondary" style={styles.tabular}>
                {` · ${distanceLabel}`}
              </Text>
            ) : null}
          </View>
          <OrderStatusBadge status={order.status} size="md" />
        </View>
        <Text size="md" weight="semibold" numberOfLines={1}>
          {order.title}
        </Text>
        <View style={styles.addressRow}>
          <IconSymbol name="mappin" size={14} color={colors.textSecondary} />
          <Text size="sm" color="textSecondary" numberOfLines={1} style={styles.addressText}>
            {order.address} · {order.client}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

// Мемоизация элемента списка обязательна (свод §4.1): перерисовывается только при смене своих
// данных (`order` по ссылке из иммутабельного стора) или темы; ререндер родителя его не трогает.
export const OrderCard = memo(OrderCardComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Shadows.card,
  },
  rail: {
    width: 3,
  },
  body: {
    flex: 1,
    paddingVertical: Spacing['14'],
    paddingHorizontal: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing['6'],
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    marginTop: Spacing['6'],
  },
  addressText: {
    flex: 1,
  },
});
