import { type FC } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { IconSymbol } from '../icon-symbol';

import { FontSize, FontWeight, Radius, Spacing, useColors } from '@/shared/config';

export type ISearchInputProps = TextInputProps;

// Поле поиска: surfaceMuted-фон, прозрачная рамка, иконка лупы слева; placeholder — textMuted, weight 400.
export const SearchInput: FC<ISearchInputProps> = ({ style, ...rest }) => {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceMuted }]}>
      <IconSymbol name="magnifyingglass" size={20} color={colors.textMuted} />
      <TextInput
        {...rest}
        style={[styles.input, { color: colors.textPrimary }, style]}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    height: 48,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  input: {
    flex: 1,
    padding: 0,
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
  },
});
