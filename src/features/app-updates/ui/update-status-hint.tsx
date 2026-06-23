import { type FC } from 'react';

import { Text } from '@/shared/ui';

interface IUpdateStatusHintProps {
  // OTA включены (false — dev-клиент / Expo Go).
  isEnabled: boolean;
  // Текст последней ошибки (включая offline); null — ошибки нет.
  errorMessage: string | null;
}

// Пояснение под кнопками: ошибка (включая offline) приоритетнее подсказки про dev.
export const UpdateStatusHint: FC<IUpdateStatusHintProps> = ({ isEnabled, errorMessage }) => {
  if (errorMessage) {
    return (
      <Text size="13" color="danger">
        {errorMessage}
      </Text>
    );
  }
  if (!isEnabled) {
    return (
      <Text size="13" color="textSecondary">
        OTA-обновления работают только в сборке EAS, не в режиме разработки.
      </Text>
    );
  }
  return null;
};
