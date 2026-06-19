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

  const paddingHorizontal = withPadding ? Spacing.md : 0;

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, Spacing.md),
          paddingHorizontal,
        }}
      >
        {children}
      </ScrollView>
    );
  }

  // Нескролящийся контейнер оборачивает самоскролящийся список (FlashList «Заявок»): он сам
  // занимает высоту до нижнего края и управляет своим нижним отступом контента. Нижний safe-area
  // инсет здесь не добавляем — иначе под списком висит пустая полоса до таб-бара.
  return (
    <View
      style={[
        styles.flex,
        { backgroundColor: colors.background, paddingTop: insets.top, paddingHorizontal },
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
