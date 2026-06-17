import type { FC } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '../text';

import { Radius, Spacing, useColors } from '@/shared/config';

export interface IChipProps {
  label: string;
  selected?: boolean;
  // Опциональный счётчик рядом с подписью; 0 отображается как «—».
  count?: number;
  onPress: () => void;
}

// Фильтр-чип: выбранное состояние визуально доминирует (PDR §9.3).
export const Chip: FC<IChipProps> = ({ label, selected = false, count, onPress }) => {
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
      {count !== undefined ? (
        <Text size="sm" weight="medium" color={selected ? 'white' : 'textMuted'}>
          {count > 0 ? count : '—'}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
  },
});
