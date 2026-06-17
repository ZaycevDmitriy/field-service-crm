import type { FC } from 'react';

import { Screen, Text } from '@/shared/ui';

// Заглушка экрана «Настройки». Диагностика доставки (EAS) и настройки — в Phase 8.
export const SettingsPage: FC = () => {
  return (
    <Screen>
      <Text size="xl" weight="bold">
        Настройки
      </Text>
    </Screen>
  );
};
