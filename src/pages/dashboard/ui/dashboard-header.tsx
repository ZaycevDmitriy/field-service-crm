import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/config';
import { Text } from '@/shared/ui';

// Шапка дашборда: eyebrow-дата (статич.) + приветствие. Структура по дизайну (без «Сегодня N заявок»).
export const DashboardHeader: FC = () => {
  return (
    <View style={styles.header}>
      <Text size="13" color="textSecondary" style={styles.eyebrow}>
        Понедельник, 4 мая
      </Text>
      <Text size="26" weight="bold">
        Доброе утро, Дмитрий
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    gap: Spacing.xxs,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
