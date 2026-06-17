import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrderStatusBadge, type IServiceOrder } from '@/entities/order';
import { Radius, Spacing, useColors } from '@/shared/config';
import { Button, IconSymbol, Text } from '@/shared/ui';

export interface INearestOrderCardProps {
  order: IServiceOrder;
  onOpen: () => void;
  onRoute: () => void;
}

// Hero «Следующая заявка»: radius 18, левый рейл 4px primary, усиленная тень, split-CTA (открыть/маршрут).
export const NearestOrderCard: FC<INearestOrderCardProps> = ({ order, onOpen, onRoute }) => {
  const colors = useColors();

  return (
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Левый рейл 4px primary — декоративная stroke-ширина (вне spacing-шкалы). */}
      <View style={[styles.rail, { backgroundColor: colors.primary }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.timeWrap}>
            <Text size="22" weight="bold" style={styles.tabular}>
              {order.scheduledTime}
            </Text>
            <Text size="13" color="textSecondary" style={styles.tabular}>
              {` · ${order.distanceLabel}`}
            </Text>
          </View>
          <OrderStatusBadge status={order.status} size="md" />
        </View>
        <Text size="lg" weight="semibold" numberOfLines={1}>
          {order.title}
        </Text>
        <View style={styles.addressRow}>
          <IconSymbol name="mappin" size={14} color={colors.textSecondary} />
          <Text size="sm" color="textSecondary" numberOfLines={1} style={styles.addressText}>
            {order.address} · {order.client}
          </Text>
        </View>
        <View style={styles.ctaRow}>
          <View style={styles.ctaPrimary}>
            <Button title="Открыть заявку" variant="primary" fullWidth onPress={onOpen} />
          </View>
          <Button
            title="Маршрут"
            variant="secondary"
            onPress={onRoute}
            leftIcon={
              <IconSymbol
                name="arrow.triangle.turn.up.right.diamond.fill"
                size={18}
                color={colors.textPrimary}
              />
            }
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    borderRadius: Radius['18'],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    // Усиленная тень hero (тяжелее карточной) — через boxShadow (New Architecture).
    boxShadow: [
      { offsetX: 0, offsetY: 8, blurRadius: 24, spreadDistance: 0, color: 'rgba(0,0,0,0.12)' },
    ],
  },
  rail: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  },
  addressText: {
    flex: 1,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  ctaPrimary: {
    flex: 1,
  },
});
