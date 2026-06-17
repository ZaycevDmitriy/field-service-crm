import type { FC } from 'react';

import { OrdersPage } from '@/pages/orders';

// Тонкий route Expo Router: рендерит страницу из слоя pages.
const OrdersRoute: FC = () => <OrdersPage />;

export default OrdersRoute;
