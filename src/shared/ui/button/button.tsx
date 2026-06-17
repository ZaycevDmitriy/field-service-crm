import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text } from '../text';

import { Radius, Spacing, useColors, type IColors } from '@/shared/config';

export type IButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type IButtonSize = 'md' | 'lg';

export interface IButtonProps {
  title: string;
  variant?: IButtonVariant;
  size?: IButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  onPress: () => void;
}

interface IVariantColors {
  background: string;
  border: string;
  text: keyof IColors;
}

// Кнопка с вариантами primary/secondary/danger/ghost (PDR §9.1).
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  onPress,
}: IButtonProps) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  // Цвета фона/границы/текста по варианту; pressed затемняет primary.
  const resolveColors = (pressed: boolean): IVariantColors => {
    switch (variant) {
      case 'primary':
        return {
          background: pressed ? colors.primaryPressed : colors.primary,
          border: 'transparent',
          text: 'white',
        };
      case 'secondary':
        return { background: colors.surface, border: colors.border, text: 'textPrimary' };
      case 'danger':
        return { background: colors.danger, border: 'transparent', text: 'white' };
      case 'ghost':
        return { background: 'transparent', border: 'transparent', text: 'primary' };
    }
  };

  // Ключ цвета текста: Text резолвит его сам, ActivityIndicator — через палитру.
  const textColorKey = resolveColors(false).text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => {
        const variantColors = resolveColors(pressed);
        return [
          styles.button,
          size === 'lg' && styles.buttonLg,
          {
            backgroundColor: variantColors.background,
            borderColor: variantColors.border,
            opacity: isDisabled ? 0.5 : 1,
          },
          fullWidth && styles.fullWidth,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors[textColorKey]} />
      ) : (
        <>
          {leftIcon}
          <Text weight="semibold" size={size === 'lg' ? '17' : 'md'} color={textColorKey}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
  },
  buttonLg: {
    minHeight: 56,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});
