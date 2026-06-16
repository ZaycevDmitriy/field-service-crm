import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { FontSize, Radius, Spacing, useColors } from '@/shared/config';

export type IInputProps = TextInputProps;

// Текстовое поле с focus-состоянием: рамка border → primary при фокусе.
export function Input({ style, onFocus, onBlur, ...rest }: IInputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...rest}
      style={[
        styles.input,
        {
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          borderColor: focused ? colors.primary : colors.border,
        },
        style,
      ]}
      placeholderTextColor={colors.textMuted}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    fontSize: FontSize.md,
  },
});
