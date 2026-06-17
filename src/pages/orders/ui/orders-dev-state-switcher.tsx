import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/config';
import { Chip, Text } from '@/shared/ui';

// DEV-инструмент: типы состояний экрана заявок. Удалить в Phase 3 — состояния пойдут из реальных данных.
export type OrdersViewState = 'content' | 'loading' | 'empty' | 'offline';

interface IDevStateOption {
  value: OrdersViewState;
  label: string;
}

const DEV_STATES: IDevStateOption[] = [
  { value: 'content', label: 'Контент' },
  { value: 'loading', label: 'Загрузка' },
  { value: 'empty', label: 'Пусто' },
  { value: 'offline', label: 'Офлайн' },
];

export interface IOrdersDevStateSwitcherProps {
  value: OrdersViewState;
  onChange: (state: OrdersViewState) => void;
}

// DEV-переключатель состояний экрана для навигации по acceptance §21. Удаляется в Phase 3 вместе с типом.
export const OrdersDevStateSwitcher: FC<IOrdersDevStateSwitcherProps> = ({ value, onChange }) => {
  return (
    <View style={styles.container}>
      <Text size="11" weight="semibold" color="textMuted" style={styles.label}>
        DEV · состояние экрана
      </Text>
      <View style={styles.row}>
        {DEV_STATES.map((state) => (
          <Chip
            key={state.value}
            label={state.label}
            selected={value === state.value}
            onPress={() => onChange(state.value)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xxs,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
});
