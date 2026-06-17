import type { FC } from 'react';

import { Screen, Text } from '@/shared/ui';

// Заглушка экрана «Главная». Полноценный дашборд появится в Phase 2 (Static UI).
export const DashboardPage: FC = () => {
  return (
    <Screen>
      <Text size="xl" weight="bold">
        Главная
      </Text>
    </Screen>
  );
};
