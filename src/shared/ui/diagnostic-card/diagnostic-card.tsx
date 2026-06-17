import { type FC, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '../card';
import { Text } from '../text';

import { Spacing } from '@/shared/config';

export interface IDiagnosticCardProps {
  title: string;
  children: ReactNode;
  // false — для списков DiagnosticRow: убирает паддинг карточки, давая дивайдеры на всю ширину.
  padded?: boolean;
}

// Секция диагностики: uppercase-заголовок над Card. Контент — ряды DiagnosticRow, кнопки или кастомные блоки.
export const DiagnosticCard: FC<IDiagnosticCardProps> = ({ title, children, padded = true }) => {
  return (
    <View style={styles.section}>
      <Text size="13" weight="semibold" color="textSecondary" style={styles.title}>
        {title.toUpperCase()}
      </Text>
      <Card style={padded ? undefined : styles.flush}>{children}</Card>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    gap: Spacing.xs,
  },
  title: {
    letterSpacing: 0.4,
  },
  flush: {
    padding: 0,
  },
});
