import { router, useLocalSearchParams } from 'expo-router';
import { type FC, useEffect } from 'react';

import { PhotoCapturePage } from '@/pages/photo';
import { logger } from '@/shared/lib/logger';

// Тонкий route Expo Router (экран съёмки корневого стека, presentation: 'fullScreenModal').
// Сегмент [orderId] удерживает контекст заявки в URL и пробрасывается в страницу для привязки
// снимка к заявке. Пустой orderId (прямой/битый переход) — закрываем экран, чтобы не рендерить
// съёмку без привязки к заявке.
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

  return <PhotoCapturePage orderId={orderId} />;
};

export default CameraRoute;
