import { type FC } from 'react';

import { Screen, Text } from '@/shared/ui';

export interface IPhotoPageProps {
  orderId: string;
}

// Заглушка экрана фото (Capture/Preview). Полное содержимое — задача #11.
export const PhotoPage: FC<IPhotoPageProps> = ({ orderId }) => {
  return (
    <Screen>
      <Text size="xl" weight="bold">
        Фото {orderId}
      </Text>
    </Screen>
  );
};
