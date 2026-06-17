import type { FC } from 'react';

import { Screen, Text } from '@/shared/ui';

// Заглушка экрана «Заявки». Список с поиском и фильтрами появится в Phase 2/3.
export const OrdersPage: FC = () => {
  return (
    <Screen>
      <Text size="xl" weight="bold">
        Заявки
      </Text>
    </Screen>
  );
};
