import { type ComponentProps, type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../button';
import { IconSymbol } from '../icon-symbol';
import { Text } from '../text';

import { Radius, Spacing, useColors } from '@/shared/config';

type IconName = ComponentProps<typeof IconSymbol>['name'];

export interface IEmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void;
}

// Пустое состояние: плитка-иконка 56×56, заголовок, текст и опциональное primary-действие.
export const EmptyState: FC<IEmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
}) => {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={[styles.iconTile, { backgroundColor: colors.surfaceMuted }]}>
        <IconSymbol name={icon} size={26} color={colors.textSecondary} />
      </View>
      <Text size="17" weight="semibold" style={styles.center}>
        {title}
      </Text>
      {description ? (
        <Text size="sm" color="textSecondary" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button
            title={actionLabel}
            variant="primary"
            onPress={onAction}
            leftIcon={
              actionIcon ? (
                <IconSymbol name={actionIcon} size={18} color={colors.white} />
              ) : undefined
            }
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
