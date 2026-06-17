import type { FC, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, useColors } from '@/shared/config';

export interface IScreenProps {
  children: ReactNode;
  scrollable?: boolean;
  withPadding?: boolean;
}

// Контейнер экрана: safe area, фон по теме, опциональные скролл и горизонтальный отступ (PDR §9.5).
export const Screen: FC<IScreenProps> = ({ children, scrollable = false, withPadding = true }) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Нижний отступ — не меньше базового, даже при нулевом insets.bottom.
  const contentInsets = {
    paddingTop: insets.top,
    paddingBottom: Math.max(insets.bottom, Spacing.md),
    paddingHorizontal: withPadding ? Spacing.md : 0,
  };

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={contentInsets}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }, contentInsets]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
