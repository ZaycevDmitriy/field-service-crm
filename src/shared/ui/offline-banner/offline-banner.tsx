import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '../icon-symbol';
import { Text } from '../text';

import { Radius, Spacing, useColors } from '@/shared/config';

// Нефиксированный баннер офлайн-режима: warning-тинт (не info), wifi-off иконка (PDR §11, решение плана 8).
export const OfflineBanner: FC = () => {
  const colors = useColors();

  return (
    <View style={[styles.banner, { backgroundColor: colors.warningSurface }]}>
      <IconSymbol name="wifi.slash" size={20} color={colors.warning} />
      <View style={styles.textColumn}>
        <Text size="sm" weight="semibold" color="warning">
          Вы офлайн
        </Text>
        <Text size="13" color="warning">
          Можно продолжать работу с сохранёнными заявками.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  textColumn: {
    flex: 1,
    gap: Spacing.xxs,
  },
});
