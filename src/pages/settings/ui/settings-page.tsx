import { type FC, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOrdersStore } from '@/entities/order';
import { UpdateStatusBadge, UpdateStatusHint, useAppUpdates } from '@/features/app-updates';
import { Radius, Spacing, useColors } from '@/shared/config';
import { formatDateTime } from '@/shared/lib/date';
import { Button, DiagnosticCard, DiagnosticRow, IconSymbol, Screen, Text } from '@/shared/ui';

// Экран «Настройки»: живая диагностика доставки (EAS Build/Update) через useAppUpdates и управление
// локальными данными. Нативный expo-updates инкапсулирован в хуке — страница его не импортирует.
export const SettingsPage: FC = () => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const ordersCount = useOrdersStore((state) => state.orders.length);
  const clearDatabase = useOrdersStore((state) => state.clearDatabase);
  const { diagnostics, isUpdatesEnabled, isChecking, errorMessage, checkForUpdate, reloadApp } =
    useAppUpdates();

  const lastCheckLabel = useMemo(
    () =>
      diagnostics.lastCheck
        ? formatDateTime(new Date(diagnostics.lastCheck))
        : 'Ещё не проверялось',
    [diagnostics.lastCheck],
  );

  const handleClearDatabase = () => {
    Alert.alert(
      'Очистить локальную БД?',
      'Все заявки и фото будут удалены с устройства. Демо-данные восстановятся при следующем запуске.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: () => {
            clearDatabase();
          },
        },
      ],
    );
  };

  return (
    <Screen scrollable={false}>
      <View style={styles.header}>
        <Text size="xl" weight="bold">
          Настройки
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <DiagnosticCard title="Профиль">
          <View style={styles.profile}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text weight="semibold" color="white">
                ДМ
              </Text>
            </View>
            <View style={styles.profileText}>
              <Text size="15" weight="semibold">
                Дмитрий Морозов
              </Text>
              <Text size="13" color="textSecondary">
                Техник · Северный участок
              </Text>
            </View>
          </View>
        </DiagnosticCard>

        <DiagnosticCard title="Приложение" padded={false}>
          <DiagnosticRow label="Версия" value={diagnostics.version} />
          <DiagnosticRow label="Build profile" value={diagnostics.buildProfile} />
          <DiagnosticRow label="Channel" value={diagnostics.channel} />
          <DiagnosticRow label="Runtime version" value={diagnostics.runtimeVersion} isLast />
        </DiagnosticCard>

        <DiagnosticCard title="Обновление">
          <View style={styles.block}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text size="13" color="textSecondary">
                  Последняя проверка
                </Text>
                <Text size="15" weight="medium">
                  {lastCheckLabel}
                </Text>
              </View>
              <UpdateStatusBadge
                isEnabled={isUpdatesEnabled}
                isUpdateAvailable={diagnostics.isUpdateAvailable}
              />
            </View>
            <Button
              title="Проверить обновления"
              variant="primary"
              fullWidth
              loading={isChecking}
              onPress={checkForUpdate}
              leftIcon={<IconSymbol name="arrow.down.circle" size={18} color={colors.white} />}
            />
            <Button
              title="Перезагрузить приложение"
              variant="secondary"
              fullWidth
              onPress={reloadApp}
              leftIcon={<IconSymbol name="arrow.clockwise" size={18} color={colors.textPrimary} />}
            />
            <UpdateStatusHint isEnabled={isUpdatesEnabled} errorMessage={errorMessage} />
          </View>
        </DiagnosticCard>

        <DiagnosticCard title="Данные">
          <View style={styles.block}>
            <View style={styles.row}>
              <View style={[styles.tile, { backgroundColor: colors.surfaceMuted }]}>
                <IconSymbol name="externaldrive.fill" size={18} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text size="15" weight="medium">
                  Локальная база
                </Text>
                <Text size="13" color="textSecondary">
                  Заявок в кэше: {ordersCount}
                </Text>
              </View>
            </View>
            <Button
              title="Очистить локальную БД"
              variant="danger"
              fullWidth
              onPress={handleClearDatabase}
              leftIcon={<IconSymbol name="trash.fill" size={18} color={colors.white} />}
            />
          </View>
        </DiagnosticCard>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.md,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
    gap: Spacing['2'],
  },
  block: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: Spacing['2'],
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: Radius['10'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
