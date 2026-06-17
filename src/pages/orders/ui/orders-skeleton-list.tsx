import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Shadows, Spacing, useColors } from '@/shared/config';
import { Skeleton } from '@/shared/ui';

// Скелет-карточка повторяет геометрию OrderCard (рейл + те же паддинги/отступы) — список не «прыгает» при загрузке.
const SkeletonCard: FC = () => {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.rail, { backgroundColor: colors.surfaceMuted }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Skeleton width={64} height={18} />
          <Skeleton width={64} height={20} radius={Radius.pill} />
        </View>
        <Skeleton width="70%" height={16} />
        <View style={styles.addressRow}>
          <Skeleton width="50%" height={14} />
        </View>
      </View>
    </View>
  );
};

// Список скелетов загрузки: 4 карточки в колонке (gap 12, как у списка заявок).
export const OrdersSkeletonList: FC = () => {
  return (
    <View style={styles.list}>
      {[0, 1, 2, 3].map((index) => (
        <SkeletonCard key={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm,
  },
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing['6'],
  },
  addressRow: {
    marginTop: Spacing['6'],
  },
});
