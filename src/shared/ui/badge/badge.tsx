import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../text';

import { Radius, Spacing, useColors, type IColors } from '@/shared/config';

export type IBadgeVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface IBadgeProps {
  variant?: IBadgeVariant;
  children: ReactNode;
}

interface IBadgeColors {
  background: string;
  text: keyof IColors;
}

// Текстовый бейдж: solid-фон по варианту, нейтральный для neutral (PDR §9.2; всегда с текстом).
export function Badge({ variant = 'neutral', children }: IBadgeProps) {
  const colors = useColors();

  const variantColors: Record<IBadgeVariant, IBadgeColors> = {
    info: { background: colors.info, text: 'white' },
    success: { background: colors.success, text: 'white' },
    warning: { background: colors.warning, text: 'white' },
    danger: { background: colors.danger, text: 'white' },
    neutral: { background: colors.surfaceMuted, text: 'textSecondary' },
  };
  const { background, text } = variantColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text size="xs" weight="medium" color={text}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.pill,
  },
});
