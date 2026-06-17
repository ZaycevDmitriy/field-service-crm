import { useLocalSearchParams } from 'expo-router';
import { type FC } from 'react';

import { PhotoPage } from '@/pages/photo';

// Тонкий route Expo Router: извлекает orderId из параметров и рендерит экран фото.
const CameraRoute: FC = () => {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  return <PhotoPage orderId={orderId} />;
};

export default CameraRoute;
