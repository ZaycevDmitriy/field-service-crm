import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing, useColors } from '@/shared/config';
import { Card, Text } from '@/shared/ui';

interface IStatProps {
  color: string;
  value: number;
  label: string;
}

// Один пункт статистики: цветная точка + значение + подпись.
const Stat: FC<IStatProps> = ({ color, value, label }) => {
  return (
    <View style={styles.stat}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text size="13" weight="medium">
        {value}
      </Text>
      <Text size="13" color="textSecondary">
        {label}
      </Text>
    </View>
  );
};

// Inline-полоса статистики дня (одна строка в Card). Значения статичны по дизайну §12.1.
export const StatsStrip: FC = () => {
  const colors = useColors();

  return (
    <Card>
      <View style={styles.row}>
        <Text size="13" color="textSecondary">
          Сегодня
        </Text>
        <View style={styles.stats}>
          <Stat color={colors.primary} value={2} label="новых" />
          <Stat color={colors.warning} value={3} label="в работе" />
          <Stat color={colors.success} value={1} label="готово" />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
});
