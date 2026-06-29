import { useRouter } from 'expo-router';
import { type FC } from 'react';

import { PhotoCaptureView } from '@/features/photo-capture';

export interface IPhotoCapturePageProps {
  // Id заявки, к которой привязывается снятое фото.
  orderId: string;
}

// Страница съёмки — тонкий оркестратор: рендерит тёмный PhotoCaptureView (feature) и связывает
// результат с навигацией. Снятый URI не хранится локально — сразу уходит push-параметром на
// предпросмотр (отдельный маршрут). Тёмный UI камеры и сервисы живут в feature.
export const PhotoCapturePage: FC<IPhotoCapturePageProps> = ({ orderId }) => {
  const router = useRouter();

  const handleCaptured = (uri: string) => {
    router.push({ pathname: '/camera/[orderId]/preview', params: { orderId, uri } });
  };

  const handleClose = () => router.back();

  return <PhotoCaptureView onCaptured={handleCaptured} onClose={handleClose} />;
};
