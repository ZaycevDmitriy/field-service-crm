import { router, useLocalSearchParams } from 'expo-router';
import { type FC, useEffect } from 'react';

import { PhotoPage } from '@/pages/photo';
import { logger } from '@/shared/lib/logger';

// Тонкий route Expo Router. Сегмент [orderId] удерживает контекст заявки в URL и пробрасывается
// в страницу для привязки снимка к заявке. Пустой orderId (прямой/битый переход) — закрываем модалку,
// чтобы не рендерить PhotoPage без привязки к заявке.
const CameraRoute: FC = () => {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  useEffect(() => {
    if (!orderId) {
      logger.warn('[CameraRoute] Пустой orderId — закрываем экран съёмки (фото некуда привязать).');
      router.back();
    }
  }, [orderId]);

  if (!orderId) {
    return null;
  }

  return <PhotoPage orderId={orderId} />;
};

export default CameraRoute;
