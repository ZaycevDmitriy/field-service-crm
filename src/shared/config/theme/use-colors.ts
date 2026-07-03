import { darkColors, lightColors, type IColors } from './colors';
import { useColorScheme } from './use-color-scheme';

// Возвращает активную палитру по системной цветовой схеме (нормализация и web-гидрация — в useColorScheme).
export function useColors(): IColors {
  const scheme = useColorScheme();

  return scheme === 'dark' ? darkColors : lightColors;
}
