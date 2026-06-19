import { useRouter } from 'expo-router';
import { type FC, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { DashboardHeader } from './dashboard-header';
import { NearestOrderCard } from './nearest-order-card';
import { QuickActionButton } from './quick-action-button';
import { StatsStrip } from './stats-strip';

import { getNearestOrder, useOrdersStore } from '@/entities/order';
import { openMapsRoute } from '@/features/open-route';
import { Spacing } from '@/shared/config';
import { useCurrentLocation } from '@/shared/lib/location';
import { useAppStore } from '@/shared/model';
import { Screen, Text } from '@/shared/ui';

// Экран «Главная»: шапка, статистика дня, hero ближайшей заявки и быстрые действия.
export const DashboardPage: FC = () => {
  const router = useRouter();
  const orders = useOrdersStore((state) => state.orders);
  // Однократная инициализация локации на главном экране (неблокирующий фон); координаты — в app-store,
  // остальные экраны читают готовое значение.
  useCurrentLocation();
  const currentLocation = useAppStore((state) => state.currentLocation);
  // Производное (решение 4 плана): ближайшая заявка — по геодистанции при доступной локации, иначе
  // по времени визита. Реактивно к смене локации (она в deps).
  const nearestOrder = useMemo(
    () => getNearestOrder(orders, currentLocation),
    [orders, currentLocation],
  );

  const handleOpenNearest = () => {
    if (!nearestOrder) {
      return;
    }
    router.push({ pathname: '/orders/[orderId]', params: { orderId: nearestOrder.id } });
  };
  // Маршрут до ближайшей заявки во внешних Яндекс.Картах (работает и без разрешения геолокации).
  const handleOpenRoute = () => {
    if (nearestOrder) {
      void openMapsRoute(nearestOrder);
    }
  };

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
