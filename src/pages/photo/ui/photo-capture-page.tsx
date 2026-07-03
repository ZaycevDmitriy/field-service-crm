import { useRouter } from 'expo-router';
import { type FC } from 'react';

import { PhotoCaptureView } from '@/features/photo-capture';
import { useGuardedBack } from '@/shared/lib/navigation';

export interface IPhotoCapturePageProps {
  // Id заявки, к которой привязывается снятое фото.
  orderId: string;
}

// Страница съёмки — тонкий оркестратор: рендерит тёмный PhotoCaptureView (feature) и связывает
// результат с навигацией. Снятый URI не хранится локально — сразу уходит параметром на предпросмотр
// (отдельный маршрут, тот же вложенный стек группы camera/[orderId]). Тёмный UI камеры и сервисы
// живут в feature.
export const PhotoCapturePage: FC<IPhotoCapturePageProps> = ({ orderId }) => {
  const router = useRouter();
  const handleClose = useGuardedBack();

  const handleCaptured = (uri: string) => {
    router.navigate({ pathname: '/camera/[orderId]/preview', params: { orderId, uri } });
  };

  return <PhotoCaptureView onCaptured={handleCaptured} onClose={handleClose} />;
};
