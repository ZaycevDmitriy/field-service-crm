import { router, useLocalSearchParams } from 'expo-router';
import { type FC, useEffect } from 'react';

import { PhotoPreviewPage } from '@/pages/photo';
import { logger } from '@/shared/lib/logger';

// Тонкий route предпросмотра (экран корневого стека, presentation: 'card' — горизонтальный push).
// orderId — из пути, uri снимка — search-параметр (expo-router сам кодирует/декодирует file://-URI).
// Пустой orderId/uri (прямой/битый переход) — возвращаемся назад, чтобы не рендерить предпросмотр
// без снимка или привязки к заявке.
const PreviewRoute: FC = () => {
  const { orderId, uri } = useLocalSearchParams<{ orderId: string; uri: string }>();

  useEffect(() => {
    if (!orderId || !uri) {
      logger.warn('[PreviewRoute] Пустой orderId/uri — закрываем предпросмотр.');
      router.back();
    }
  }, [orderId, uri]);

  if (!orderId || !uri) {
    return null;
  }

  return <PhotoPreviewPage orderId={orderId} uri={uri} />;
};

export default PreviewRoute;
