import { StyleSheet, View, type ViewProps } from 'react-native';

import { useColors } from '@/shared/config';

export type IDividerProps = ViewProps;

// Горизонтальная разделительная линия цвета border.
export function Divider({ style, ...rest }: IDividerProps) {
  const colors = useColors();

  return <View style={[styles.divider, { backgroundColor: colors.border }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
  },
});
