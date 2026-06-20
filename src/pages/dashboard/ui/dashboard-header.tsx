import { type FC, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/config';
import { formatLongDate, getGreeting } from '@/shared/lib/date';
import { Text } from '@/shared/ui';

// Шапка дашборда: eyebrow с текущей датой + приветствие по времени суток. Без «Сегодня N заявок».
export const DashboardHeader: FC = () => {
  // Дата и приветствие фиксируются на маунт экрана.
  const { today, greeting } = useMemo(() => {
    const now = new Date();
    return {
      today: formatLongDate(now),
      greeting: getGreeting(now.getHours()),
    };
  }, []);

  return (
    <View style={styles.header}>
      <Text size="13" color="textSecondary" style={styles.eyebrow}>
        {today}
      </Text>
      <Text size="26" weight="bold">
        {greeting}, Дмитрий
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
