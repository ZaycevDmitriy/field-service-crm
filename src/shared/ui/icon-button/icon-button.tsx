import { type ComponentProps, type FC } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { IconSymbol } from '../icon-symbol';

import { Radius, useColors } from '@/shared/config';

type IconName = ComponentProps<typeof IconSymbol>['name'];

export interface IIconButtonProps {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'surface' | 'plain';
  // Размер квадрата кнопки; hitSlop добавляется автоматически до эффективных ≥44px.
  size?: number;
  iconSize?: number;
  color?: string;
  disabled?: boolean;
}

// Иконочная кнопка с обязательным accessibilityLabel. Тап-таргет гарантированно ≥44px через hitSlop.
export const IconButton: FC<IIconButtonProps> = ({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  size = 44,
  iconSize = 20,
  color,
  disabled = false,
}) => {
  const colors = useColors();
  const hitSlop = Math.max(0, Math.round((44 - size) / 2));

  const resolveOpacity = (pressed: boolean): number => {
    if (disabled) {
      return 0.5;
    }

    return pressed ? 0.6 : 1;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        variant === 'surface' && {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: Radius['10'],
        },
        { opacity: resolveOpacity(pressed) },
      ]}
    >
      <IconSymbol name={icon} size={iconSize} color={color ?? colors.textPrimary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
