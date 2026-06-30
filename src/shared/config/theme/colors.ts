export interface IColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryPressed: string;
  // Роль «на поверхности» (иконки/числа/focus-border/rail/tint): достаточный контраст на surface
  // обеих тем. primary остаётся white-safe заливкой под белым текстом, accent читается как контент.
  accent: string;
  success: string;
  successSurface: string;
  warning: string;
  warningSurface: string;
  danger: string;
  dangerSurface: string;
  // danger «на поверхности» (danger-текст/иконка на тинте): danger остаётся white-safe заливкой кнопки.
  dangerAccent: string;
  info: string;
  infoSurface: string;
  black: string;
  white: string;
}

// Светлая палитра (PDR §8.2). textSecondary/textMuted затемнены до WCAG AA (читаемый текст ≥4.5);
// success/info затемнены до AA для текста на своих *Surface-тинтах (бейджи/тосты).
export const lightColors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F5',
  textPrimary: '#101828',
  textSecondary: '#586273',
  textMuted: '#646D79',
  border: '#E4E7EC',
  primary: '#2563EB',
  primaryPressed: '#1D4ED8',
  accent: '#2563EB',
  success: '#15803D',
  successSurface: '#F0FDF4',
  warning: '#B45309',
  warningSurface: '#FFFBEB',
  danger: '#DC2626',
  dangerSurface: '#FEF2F2',
  dangerAccent: '#B42318',
  info: '#0369A1',
  infoSurface: '#F0F9FF',
  black: '#000000',
  white: '#FFFFFF',
} as const satisfies IColors;

// Тёмная палитра (PDR §8.2): тёплый нейтральный фон, не чистый чёрный. primary/danger — white-safe
// заливки (тёмный синий/красный под белым текстом, white ≥4.5); accent/dangerAccent — светлые тона
// «на поверхности» (иконки/текст/rail на surface ≥4.5). textMuted поднят до AA, info осветлён для
// текста на infoSurface.
export const darkColors = {
  background: '#1C1C1E',
  surface: '#2C2C2E',
  surfaceMuted: '#3A3A3C',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.65)',
  textMuted: 'rgba(235,235,245,0.62)',
  border: 'rgba(255,255,255,0.10)',
  primary: '#2563EB',
  primaryPressed: '#1D4ED8',
  accent: '#8AB0F5',
  success: '#34D399',
  successSurface: 'rgba(52,211,153,0.18)',
  warning: '#FBBF24',
  warningSurface: 'rgba(251,191,36,0.18)',
  danger: '#DC2626',
  // Тинт error-плашки и его текст dangerAccent — мягкое красное семейство, не производное от danger-заливки.
  dangerSurface: 'rgba(248,113,113,0.18)',
  dangerAccent: '#FCA5A5',
  info: '#93C5FD',
  infoSurface: 'rgba(96,165,250,0.18)',
  black: '#000000',
  white: '#FFFFFF',
} as const satisfies IColors;
