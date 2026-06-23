import { type FC } from 'react';

import { Badge } from '@/shared/ui';

interface IUpdateStatusBadgeProps {
  // OTA включены (false — dev-клиент / Expo Go).
  isEnabled: boolean;
  isUpdateAvailable: boolean;
}

// Бейдж статуса обновления: dev-недоступность приоритетнее наличия обновления.
export const UpdateStatusBadge: FC<IUpdateStatusBadgeProps> = ({
  isEnabled,
  isUpdateAvailable,
}) => {
  if (!isEnabled) {
    return <Badge variant="neutral">Недоступно в dev</Badge>;
  }
  if (isUpdateAvailable) {
    return <Badge variant="warning">Доступно обновление</Badge>;
  }
  return <Badge variant="success">Актуально</Badge>;
};
