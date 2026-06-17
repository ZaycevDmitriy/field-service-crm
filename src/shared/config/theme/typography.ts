// Системный шрифт RN; кастомный шрифт для MVP не подключаем (PDR §8.6).
// Базовая t-shirt-шкала + промежуточные шаги из макета fm-bundle (Phase 2): числовой ключ = размер в px.
export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  '11': 11,
  '13': 13,
  '15': 15,
  '17': 17,
  '22': 22,
  '26': 26,
} as const;
export const FontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;
