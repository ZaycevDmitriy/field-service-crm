import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing, useColors } from '@/shared/config';
import {
  Badge,
  Button,
  DiagnosticCard,
  DiagnosticRow,
  IconSymbol,
  Screen,
  Text,
} from '@/shared/ui';

// Экран «Настройки»: статическая диагностика доставки (EAS) и данные. Значения статичны, кнопки no-op (Phase 8).
export const SettingsPage: FC = () => {
  const colors = useColors();
  // Действия — Phase 8 (реальные updates/очистка БД). Пока no-op.
  const noop = () => undefined;

  return (
    <Screen scrollable>
      <View style={styles.content}>
        <Text size="xl" weight="bold">
          Настройки
        </Text>

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
          <DiagnosticRow label="Версия" value="1.0.0" />
          <DiagnosticRow label="Build profile" value="preview" />
          <DiagnosticRow label="Channel" value="preview" />
          <DiagnosticRow label="Runtime version" value="1.0.0" isLast />
        </DiagnosticCard>

        <DiagnosticCard title="Updates">
          <View style={styles.block}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text size="13" color="textSecondary">
                  Последняя проверка
                </Text>
                <Text size="15" weight="medium">
                  Сегодня, 10:42
                </Text>
              </View>
              <Badge variant="success">Актуально</Badge>
            </View>
            <Button
              title="Проверить обновления"
              variant="primary"
              fullWidth
              onPress={noop}
              leftIcon={<IconSymbol name="arrow.down.circle" size={18} color={colors.white} />}
            />
            <Button
              title="Перезагрузить приложение"
              variant="secondary"
              fullWidth
              onPress={noop}
              leftIcon={<IconSymbol name="arrow.clockwise" size={18} color={colors.textPrimary} />}
            />
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
                  12.4 МБ · 87 заявок в кэше
                </Text>
              </View>
            </View>
            <Button
              title="Очистить локальную БД"
              variant="danger"
              fullWidth
              onPress={noop}
              leftIcon={<IconSymbol name="trash.fill" size={18} color={colors.white} />}
            />
          </View>
        </DiagnosticCard>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
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
