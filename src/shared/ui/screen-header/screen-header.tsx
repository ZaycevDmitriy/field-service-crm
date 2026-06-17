import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '../icon-button';
import { Text } from '../text';

import { Spacing } from '@/shared/config';

export interface IScreenHeaderProps {
  title: string;
  onBack: () => void;
}

// Шапка полноэкранного роута: кнопка «назад» (36×36, surface, рамка) + заголовок 24/700.
export const ScreenHeader: FC<IScreenHeaderProps> = ({ title, onBack }) => {
  return (
    <View style={styles.header}>
      <IconButton
        icon="chevron.left"
        accessibilityLabel="Назад"
        onPress={onBack}
        variant="surface"
        size={36}
      />
      <Text size="xl" weight="bold">
        {title}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
