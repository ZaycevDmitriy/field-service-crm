import { type ComponentProps, type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../button';
import { IconSymbol } from '../icon-symbol';
import { Text } from '../text';

import { Radius, Spacing, useColors } from '@/shared/config';

type IconName = ComponentProps<typeof IconSymbol>['name'];

export interface IErrorStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onRetry?: () => void;
  icon?: IconName;
}

// Состояние ошибки: плитка-иконка с danger-тинтом, заголовок, текст и опциональная кнопка повтора.
export const ErrorState: FC<IErrorStateProps> = ({
  title,
  description,
  actionLabel,
  onRetry,
  icon = 'exclamationmark.triangle.fill',
}) => {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={[styles.iconTile, { backgroundColor: colors.dangerSurface }]}>
        <IconSymbol name={icon} size={26} color={colors.dangerAccent} />
      </View>
      <Text size="17" weight="semibold" style={styles.center}>
        {title}
      </Text>
      {description ? (
        <Text size="sm" color="textSecondary" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onRetry ? (
        <View style={styles.action}>
          <Button
            title={actionLabel}
            variant="primary"
            onPress={onRetry}
            leftIcon={<IconSymbol name="arrow.clockwise" size={18} color={colors.white} />}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    maxWidth: 280,
  },
  action: {
    marginTop: Spacing.xs,
  },
});
