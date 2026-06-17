import type { FC } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '../text';

import { Radius, Spacing, useColors } from '@/shared/config';

export interface IChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

// Фильтр-чип: выбранное состояние визуально доминирует (PDR §9.3).
export const Chip: FC<IChipProps> = ({ label, selected = false, onPress }) => {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text size="sm" weight="medium" color={selected ? 'white' : 'textPrimary'}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
  },
});
