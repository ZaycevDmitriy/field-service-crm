import { type FC, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { countPendingMutations, pushMutations, useOrdersStore } from '@/entities/order';
import { logout, UserRoleLabel, useSessionStore } from '@/entities/session';
import { UpdateStatusBadge, UpdateStatusHint, useAppUpdates } from '@/features/app-updates';
import { Radius, Spacing, useColors } from '@/shared/config';
import { formatDateTime } from '@/shared/lib/date';
import { logger } from '@/shared/lib/logger';
import { cancelAllReminders } from '@/shared/lib/notifications';
import { Button, DiagnosticCard, DiagnosticRow, IconSymbol, Screen, Text } from '@/shared/ui';

// Экран «Настройки»: живая диагностика доставки (EAS Build/Update) через useAppUpdates и управление
// локальными данными. Нативный expo-updates инкапсулирован в хуке — страница его не импортирует.
export const SettingsPage: FC = () => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const user = useSessionStore((state) => state.user);
  const ordersCount = useOrdersStore((state) => state.orders.length);
  const clearDatabase = useOrdersStore((state) => state.clearDatabase);
  const { diagnostics, isUpdatesEnabled, isChecking, errorMessage, checkForUpdate, reloadApp } =
    useAppUpdates();
  // Временное состояние экрана (не Zustand): диалог логаута синхронизирует очередь перед выходом,
  // кнопка «Выйти» задизейблена на это время (T6, PDR client-sync §8, решение Q-02).
  const [isSyncingLogout, setIsSyncingLogout] = useState(false);

  const lastCheckLabel = useMemo(
    () =>
      diagnostics.lastCheck
        ? formatDateTime(new Date(diagnostics.lastCheck))
        : 'Ещё не проверялось',
    [diagnostics.lastCheck],
  );

  // Показывает финальный выбор при непустой очереди после (не)удачной попытки синка — «Отмена» /
  // «Выйти с потерей N» (ровно 2 кнопки + Cancel уже не нужен здесь, диалог самостоятельный).
  const showDiscardAlert = (remaining: number) => {
    Alert.alert(
      'Не удалось синхронизировать',
      `Осталось несинхронизированных изменений: ${remaining}.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: `Выйти с потерей ${remaining} изменений`,
          style: 'destructive',
          onPress: () => void logout(),
        },
      ],
    );
  };

  // «Синхронизировать и выйти»: push ДО logout — после отзыва токенов дослать очередь нельзя
  // (PDR T-04). Успех (очередь пуста) → logout(); неудача/остаток — явный выбор через showDiscardAlert.
  const syncAndLogout = async (): Promise<void> => {
    setIsSyncingLogout(true);
    try {
      await pushMutations();
    } catch (error) {
      logger.error('[settingsPage.handleLogout] Push перед выходом не удался.', error);
    }

    const remaining = await countPendingMutations();
    setIsSyncingLogout(false);

    if (remaining === 0) {
      logger.info('[settingsPage.handleLogout] Логаут: очередь синхронизирована перед выходом.');
      void logout();

      return;
    }
    showDiscardAlert(remaining);
  };

  const handleLogout = async () => {
    const pending = await countPendingMutations();

    if (pending === 0) {
      Alert.alert('Выйти из аккаунта?', 'Вы сможете войти снова по email и паролю.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Выйти', style: 'destructive', onPress: () => void logout() },
      ]);

      return;
    }

    // Ровно 3 кнопки — лимит Android (Alert.alert обрезает buttons.slice(0, 3), см. CLAUDE.md).
    Alert.alert(
      'Несинхронизированные изменения',
      `Изменений в очереди: ${pending}. Синхронизировать перед выходом?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Синхронизировать и выйти',
          onPress: () => {
            logger.info('[settingsPage.handleLogout] Логаут с непустым outbox.', {
              pending,
              choice: 'sync',
            });
            void syncAndLogout();
          },
        },
        {
          text: 'Выйти с потерей',
          style: 'destructive',
          onPress: () => {
            logger.info('[settingsPage.handleLogout] Логаут с непустым outbox.', {
              pending,
              choice: 'discard',
            });
            void logout();
          },
        },
      ],
    );
  };

  const handleClearDatabase = () => {
    Alert.alert(
      'Очистить локальную БД?',
      'Все заявки, фото и напоминания будут удалены с устройства.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: () => {
            clearDatabase();
            // Напоминания по удаляемым заявкам больше не актуальны. Fire-and-forget: graceful внутри.
            void cancelAllReminders();
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
        <DiagnosticCard title="Аккаунт" padded={false}>
          <DiagnosticRow label="Имя" value={user?.displayName ?? '—'} />
          <DiagnosticRow label="Email" value={user?.email ?? '—'} />
          <DiagnosticRow label="Роль" value={user ? UserRoleLabel[user.role] : '—'} isLast />
          <View style={styles.accountAction}>
            <Button
              title="Выйти"
              variant="danger"
              fullWidth
              loading={isSyncingLogout}
              disabled={isSyncingLogout}
              onPress={handleLogout}
              testID="settings-logout-button"
              accessibilityLabel="Выйти из аккаунта"
              leftIcon={
                <IconSymbol
                  name="rectangle.portrait.and.arrow.right"
                  size={18}
                  color={colors.white}
                />
              }
            />
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
                <IconSymbol name="externaldrive.fill" size={18} color={colors.accent} />
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
  accountAction: {
    padding: Spacing.md,
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
