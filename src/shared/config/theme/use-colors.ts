import { useColorScheme } from 'react-native';

import {
  darkColors,
  darkOrderStatusColors,
  lightColors,
  lightOrderStatusColors,
  type IColors,
  type IOrderStatusColors,
} from './colors';

// Возвращает активную палитру по системной цветовой схеме; light — fallback при unspecified/null.
export function useColors(): IColors {
  const scheme = useColorScheme();

  return scheme === 'dark' ? darkColors : lightColors;
}

// Возвращает активную карту цветов статусов заявок по системной цветовой схеме.
export function useOrderStatusColors(): IOrderStatusColors {
  const scheme = useColorScheme();

  return scheme === 'dark' ? darkOrderStatusColors : lightOrderStatusColors;
}
