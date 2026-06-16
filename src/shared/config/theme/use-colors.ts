import {
  darkColors,
  darkOrderStatusColors,
  lightColors,
  lightOrderStatusColors,
  type IColors,
  type IOrderStatusColors,
} from './colors';
import { useColorScheme } from './use-color-scheme';

// Возвращает активную палитру по системной цветовой схеме (нормализация и web-гидрация — в useColorScheme).
export function useColors(): IColors {
  const scheme = useColorScheme();

  return scheme === 'dark' ? darkColors : lightColors;
}

// Возвращает активную карту цветов статусов заявок по системной цветовой схеме.
export function useOrderStatusColors(): IOrderStatusColors {
  const scheme = useColorScheme();

  return scheme === 'dark' ? darkOrderStatusColors : lightOrderStatusColors;
}
