import { type FC } from 'react';

import { promptOrderReminder } from '../model/order-reminder';

import type { IServiceOrder } from '@/entities/order';
import { useColors } from '@/shared/config';
import { Button, IconSymbol } from '@/shared/ui';

export interface IOrderReminderButtonProps {
  order: IServiceOrder;
  fullWidth?: boolean;
}

// Инлайн-кнопка «Напомнить»: открывает выбор пресета и планирует локальное напоминание по заявке
// (order-details). Вся оркестрация — в promptOrderReminder; кнопка лишь дёргает её по нажатию.
export const OrderReminderButton: FC<IOrderReminderButtonProps> = ({ order, fullWidth = true }) => {
  const colors = useColors();

  return (
    <Button
      title="Напомнить"
      variant="secondary"
      fullWidth={fullWidth}
      onPress={() => promptOrderReminder(order)}
      leftIcon={<IconSymbol name="bell.fill" size={18} color={colors.textPrimary} />}
    />
  );
};
