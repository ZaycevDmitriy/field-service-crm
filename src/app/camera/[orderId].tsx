import { useLocalSearchParams } from 'expo-router';
import { type FC } from 'react';

import { PhotoPage } from '@/pages/photo';
import { logger } from '@/shared/lib/logger';

// Тонкий route Expo Router. Сегмент [orderId] удерживает контекст заявки в URL и пробрасывается
// в страницу для привязки снимка к заявке.
const CameraRoute: FC = () => {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  if (!orderId) {
    logger.warn('[PhotoPage] Пустой orderId — снятое фото не будет привязано к заявке.');
  }

  return <PhotoPage orderId={orderId ?? ''} />;
};

export default CameraRoute;
