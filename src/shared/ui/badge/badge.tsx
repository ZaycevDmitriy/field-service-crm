import { useMemo, type FC, type ReactNode } from 'react';
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

// Текстовый бейдж: tinted-фон (*Surface) + насыщенный текст того же семейства; danger-текст —
// dangerAccent (danger зарезервирован под white-safe заливку). Все варианты ≥4.5 обе темы (PDR §9.2).
export const Badge: FC<IBadgeProps> = ({ variant = 'neutral', children }) => {
  const colors = useColors();

  // Карта цветов по варианту; пересоздаётся только при смене темы (ссылка colors стабильна).
  const variantColors = useMemo<Record<IBadgeVariant, IBadgeColors>>(
    () => ({
      info: { background: colors.infoSurface, text: 'info' },
      success: { background: colors.successSurface, text: 'success' },
      warning: { background: colors.warningSurface, text: 'warning' },
      danger: { background: colors.dangerSurface, text: 'dangerAccent' },
      neutral: { background: colors.surfaceMuted, text: 'textSecondary' },
    }),
    [colors],
  );
  const { background, text } = variantColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text size="xs" weight="medium" color={text}>
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.pill,
  },
});
