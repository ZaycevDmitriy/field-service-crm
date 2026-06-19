import { type FC } from 'react';

import { openMapsRoute } from '../lib/openMapsRoute';

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

  return (
    <Button
      title="Открыть маршрут"
      variant="secondary"
      fullWidth={fullWidth}
      onPress={() => {
        void openMapsRoute(order);
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
