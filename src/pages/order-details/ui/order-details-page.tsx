import { useRouter } from 'expo-router';
import { type ComponentProps, type FC, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  OrderPhotoList,
  OrderStatusBadge,
  ServiceOrderStatusEnum,
  useOrderDistanceLabel,
  useOrdersStore,
} from '@/entities/order';
import { OpenRouteButton } from '@/features/open-route';
import { useOrderStatusActions } from '@/features/order-status';
import { Radius, Spacing, useColors } from '@/shared/config';
import { Button, DiagnosticCard, ErrorState, IconSymbol, ScreenHeader, Text } from '@/shared/ui';

export interface IOrderDetailsPageProps {
  orderId: string;
}

type IconName = ComponentProps<typeof IconSymbol>['name'];

// Иконочная плитка 36×36 для строк секций «Адрес»/«Время».
const InfoTile: FC<{ icon: IconName }> = ({ icon }) => {
  const colors = useColors();

  return (
    <View style={[styles.tile, { backgroundColor: colors.surfaceMuted }]}>
      <IconSymbol name={icon} size={18} color={colors.primary} />
    </View>
  );
};

// Экран деталей заявки (New / In Progress / прочие): шапка, статус+тайтл, секции и фиксированный нижний CTA.
export const OrderDetailsPage: FC<IOrderDetailsPageProps> = ({ orderId }) => {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Реальная высота фиксированного CTA-бара — для точного нижнего отступа скролла (New и InProgress разной высоты).
  const [ctaHeight, setCtaHeight] = useState(0);
  // Заявка из стора по id (один объект — без useShallow). Смена статуса меняет ссылку → реактивный ре-рендер.
  const order = useOrdersStore((state) => state.orders.find((item) => item.id === orderId));
  // Хук actions вызывается безусловно (до early return) — правила хуков; orderId всегда есть.
  const { startWork, completeWork, cancelOrder } = useOrderStatusActions(orderId);
  // Дистанция — производное от текущей локации; хук терпит undefined order (вызов до early return).
  const distanceLabel = useOrderDistanceLabel(order);

  const handleBack = () => router.back();

  if (!order) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ScreenHeader title="Заявка" onBack={handleBack} />
        <ErrorState title="Заявка не найдена" description="Не удалось открыть эту заявку." />
      </View>
    );
  }

  const isNew = order.status === ServiceOrderStatusEnum.New;
  const isInProgress = order.status === ServiceOrderStatusEnum.InProgress;
  const hasCta = isNew || isInProgress;
  const hasPhotos = order.photos.length > 0;

  const handleAddPhoto = () => {
    router.push({ pathname: '/camera/[orderId]', params: { orderId: order.id } });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScreenHeader title="Заявка" onBack={handleBack} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: hasCta ? ctaHeight + Spacing.md : insets.bottom + Spacing.md },
        ]}
      >
        <View style={styles.titleBlock}>
          <OrderStatusBadge status={order.status} size="lg" />
          <Text size="xl" weight="bold">
            {order.title}
          </Text>
          <Text size="sm" color="textSecondary">
            Клиент: {order.client}
          </Text>
        </View>

        <DiagnosticCard title="Адрес">
          <View style={styles.sectionColumn}>
            <View style={styles.tileRow}>
              <InfoTile icon="mappin" />
              <View style={styles.tileText}>
                <Text size="15" weight="medium">
                  {order.address}
                </Text>
                {distanceLabel ? (
                  <Text size="13" color="textSecondary">
                    {distanceLabel} от вас
                  </Text>
                ) : null}
              </View>
            </View>
            <OpenRouteButton order={order} />
          </View>
        </DiagnosticCard>

        <DiagnosticCard title="Время">
          <View style={styles.tileRow}>
            <InfoTile icon="clock" />
            <View style={styles.tileText}>
              <Text size="15" weight="medium">
                Сегодня, {order.scheduledTime}
              </Text>
              <Text size="13" color="textSecondary">
                Слот: {order.scheduledSlot}
              </Text>
            </View>
          </View>
        </DiagnosticCard>

        <DiagnosticCard title="Описание">
          <Text size="sm" style={styles.description}>
            {order.description}
          </Text>
        </DiagnosticCard>

        <DiagnosticCard title="Фотоотчёт">
          <View style={styles.sectionColumn}>
            {hasPhotos ? (
              <>
                <OrderPhotoList photos={order.photos} />
                <Text size="13" color="textSecondary" style={styles.photoCount}>
                  {order.photos.length} фото
                </Text>
                <Button
                  title="Добавить фото"
                  variant="secondary"
                  fullWidth
                  onPress={handleAddPhoto}
                  leftIcon={<IconSymbol name="camera.fill" size={18} color={colors.textPrimary} />}
                />
              </>
            ) : (
              <>
                <View style={[styles.dashed, { borderColor: colors.border }]}>
                  <View style={[styles.photoTile, { backgroundColor: colors.surfaceMuted }]}>
                    <IconSymbol name="camera.fill" size={20} color={colors.textSecondary} />
                  </View>
                  <Text size="sm" color="textSecondary" style={styles.dashedText}>
                    Сделайте фото после выполнения работы
                  </Text>
                </View>
                <Button
                  title="Добавить фото"
                  variant="secondary"
                  fullWidth
                  onPress={handleAddPhoto}
                  leftIcon={<IconSymbol name="plus" size={18} color={colors.textPrimary} />}
                />
              </>
            )}
          </View>
        </DiagnosticCard>
      </ScrollView>

      {hasCta ? (
        <View
          onLayout={(event) => setCtaHeight(event.nativeEvent.layout.height)}
          style={[
            styles.cta,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + Spacing.sm,
            },
          ]}
        >
          {isNew ? (
            <Button
              title="Начать работу"
              variant="primary"
              size="lg"
              fullWidth
              onPress={startWork}
            />
          ) : (
            <>
              <Button
                title="Завершить"
                variant="primary"
                size="lg"
                fullWidth
                onPress={completeWork}
                leftIcon={<IconSymbol name="checkmark" size={18} color={colors.white} />}
              />
              <Pressable onPress={cancelOrder} accessibilityRole="button" style={styles.cancelLink}>
                <Text size="md" weight="semibold" color="danger">
                  Отменить заявку
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    gap: Spacing.md,
  },
  titleBlock: {
    gap: Spacing.xs,
  },
  sectionColumn: {
    gap: Spacing.sm,
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: Radius['10'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    flex: 1,
    gap: Spacing['2'],
  },
  // Описание: lineHeight 1.5 от 14px для читаемости (типографика вне токен-шкалы).
  description: {
    lineHeight: 21,
  },
  photoCount: {
    alignSelf: 'flex-end',
  },
  dashed: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  photoTile: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedText: {
    textAlign: 'center',
  },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  cancelLink: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
