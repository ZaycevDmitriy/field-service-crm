import { useRouter } from 'expo-router';
import { type FC, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { DashboardHeader } from './dashboard-header';
import { NearestOrderCard } from './nearest-order-card';
import { QuickActionButton } from './quick-action-button';
import { StatsStrip } from './stats-strip';

import { getNearestOrder, useOrdersStore } from '@/entities/order';
import { Spacing } from '@/shared/config';
import { Screen, Text } from '@/shared/ui';

// Экран «Главная»: шапка, статистика дня, hero ближайшей заявки и быстрые действия.
export const DashboardPage: FC = () => {
  const router = useRouter();
  const orders = useOrdersStore((state) => state.orders);
  // Производное (решение 4 плана): ближайшая активная заявка считается чистой функцией из стора.
  const nearestOrder = useMemo(() => getNearestOrder(orders), [orders]);

  const handleOpenNearest = () => {
    if (!nearestOrder) {
      return;
    }
    router.push({ pathname: '/orders/[orderId]', params: { orderId: nearestOrder.id } });
  };
  // Открытие маршрута — Phase 6 (геолокация). Пока no-op.
  const handleOpenRoute = () => undefined;

  return (
    <Screen scrollable>
      <View style={styles.content}>
        <DashboardHeader />
        <StatsStrip />
        {nearestOrder ? (
          <View style={styles.section}>
            <Text size="13" color="textSecondary" style={styles.eyebrow}>
              Следующая заявка · через 1ч 30м
            </Text>
            <NearestOrderCard
              order={nearestOrder}
              onOpen={handleOpenNearest}
              onRoute={handleOpenRoute}
            />
          </View>
        ) : null}
        <View style={styles.section}>
          <Text size="lg" weight="semibold">
            Быстрые действия
          </Text>
          <View style={styles.quickGrid}>
            <QuickActionButton icon="plus" title="Новая заявка" subtitle="Создать вручную" />
            <QuickActionButton
              icon="qrcode.viewfinder"
              title="Сканировать"
              subtitle="QR-код заявки"
            />
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.xs,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
