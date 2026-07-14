import { type FC } from 'react';

import { openMapsRoute } from '../lib/open-maps-route';

import type { IServiceOrder } from '@/entities/order';
import { useColors } from '@/shared/config';
import { Button, IconSymbol } from '@/shared/ui';

export interface IOpenRouteButtonProps {
  order: IServiceOrder;
  fullWidth?: boolean;
}

// Инлайн-кнопка «Открыть маршрут»: строит маршрут до заявки во внешних Яндекс.Картах (order-details).
// Дашборд использует функцию openMapsRoute напрямую — там кнопка живёт в split-CTA hero-карточки.
export const OpenRouteButton: FC<IOpenRouteButtonProps> = ({ order, fullWidth = true }) => {
  const colors = useColors();

  // Заявка без координат (Phase 11: latitude/longitude nullable) — маршрут строить не от чего,
  // кнопка не рендерится (сигнатура openMapsRoute/IRouteDestination не меняется).
  if (order.latitude === null || order.longitude === null) {
    return null;
  }
  // Локальный const с уже сузенными полями: TS не переносит narrowing вложенного свойства
  // (order.latitude !== null) на весь объект order при передаче его в другую функцию.
  const destination = { latitude: order.latitude, longitude: order.longitude };

  return (
    <Button
      title="Открыть маршрут"
      variant="secondary"
      fullWidth={fullWidth}
      onPress={() => {
        void openMapsRoute(destination);
      }}
      leftIcon={
        <IconSymbol
          name="arrow.triangle.turn.up.right.diamond.fill"
          size={18}
          color={colors.textPrimary}
        />
      }
    />
  );
};
