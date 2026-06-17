import { type FC } from 'react';

import { Screen, Text } from '@/shared/ui';

export interface IOrderDetailsPageProps {
  orderId: string;
}

// Заглушка экрана деталей заявки. Полное содержимое — задача #10.
export const OrderDetailsPage: FC<IOrderDetailsPageProps> = ({ orderId }) => {
  return (
    <Screen>
      <Text size="xl" weight="bold">
        Заявка {orderId}
      </Text>
    </Screen>
  );
};
