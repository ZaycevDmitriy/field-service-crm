import { useLocalSearchParams } from 'expo-router';
import { type FC } from 'react';

import { OrderDetailsPage } from '@/pages/order-details';

// Тонкий route Expo Router: извлекает orderId из параметров и рендерит страницу деталей.
const OrderDetailsRoute: FC = () => {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  return <OrderDetailsPage orderId={orderId} />;
};

export default OrderDetailsRoute;
