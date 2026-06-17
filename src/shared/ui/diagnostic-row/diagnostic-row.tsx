import { type ComponentProps, type FC, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '../icon-symbol';
import { Text } from '../text';

import { Spacing, useColors } from '@/shared/config';

type IconName = ComponentProps<typeof IconSymbol>['name'];

export interface IDiagnosticRowProps {
  label: string;
  value?: string;
  icon?: IconName;
  // Правый слот: пилюля-статус, кнопка и т.п.
  action?: ReactNode;
  // Последняя строка в карточке — без нижней границы.
  isLast?: boolean;
}

// Строка диагностики (паттерн InfoRow): опц. иконка + label слева, value/action справа, нижняя граница.
export const DiagnosticRow: FC<IDiagnosticRowProps> = ({
  label,
  value,
  icon,
  action,
  isLast = false,
}) => {
  const colors = useColors();

  return (
    <View
      style={[
        styles.row,
        !isLast && {
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {icon ? <IconSymbol name={icon} size={18} color={colors.textSecondary} /> : null}
      <Text size="13" color="textSecondary" style={styles.label}>
        {label}
      </Text>
      {value ? (
        <Text size="15" weight="medium">
          {value}
        </Text>
      ) : null}
      {action}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  label: {
    flex: 1,
  },
});
