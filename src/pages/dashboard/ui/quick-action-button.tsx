import { type ComponentProps, type FC } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, useColors } from '@/shared/config';
import { Card, IconSymbol, Text } from '@/shared/ui';

type IconName = ComponentProps<typeof IconSymbol>['name'];

export interface IQuickActionButtonProps {
  icon: IconName;
  title: string;
  subtitle: string;
  // Действия пока нефункциональны (создание заявки — Phase 3, скан — Phase 5).
  onPress?: () => void;
}

// Кнопка быстрого действия (Card): иконочная плитка 36×36 + заголовок + подпись.
export const QuickActionButton: FC<IQuickActionButtonProps> = ({
  icon,
  title,
  subtitle,
  onPress,
}) => {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pressable, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Card style={styles.card}>
        <View style={[styles.tile, { backgroundColor: colors.surfaceMuted }]}>
          <IconSymbol name={icon} size={20} color={colors.primary} />
        </View>
        <Text size="15" weight="semibold">
          {title}
        </Text>
        <Text size="13" color="textSecondary">
          {subtitle}
        </Text>
      </Card>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  card: {
    gap: Spacing['6'],
    alignItems: 'flex-start',
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: Radius['10'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['6'],
  },
});
