import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Shadows, Spacing, useColors } from '@/shared/config';

export type ICardProps = ViewProps;

// Базовая поверхность: surface-фон, рамка, скругление и мягкая тень (PDR §9.4).
export function Card({ style, children, ...rest }: ICardProps) {
  const colors = useColors();

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
});
