import {
  darkOrderStatusColors,
  lightOrderStatusColors,
  type IOrderStatusColors,
} from './order-status-colors';

import { useColorScheme } from '@/shared/config/theme';

// Возвращает активную карту цветов статусов заявок по системной цветовой схеме. Перенесён сюда из
// shared/config/theme (PDR §8.3): статусы — доменная концепция entities/order, не темы.
export function useOrderStatusColors(): IOrderStatusColors {
  const scheme = useColorScheme();

  return scheme === 'dark' ? darkOrderStatusColors : lightOrderStatusColors;
}
