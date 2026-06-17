import { type FC } from 'react';

import { PhotoPage } from '@/pages/photo';

// Тонкий route Expo Router. Сегмент [orderId] удерживает контекст заявки в URL для Phase 5
// (привязка снимка к заявке); в Phase 2 экран фото статичен и параметр не читается.
const CameraRoute: FC = () => {
  return <PhotoPage />;
};

export default CameraRoute;
