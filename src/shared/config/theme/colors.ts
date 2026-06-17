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
  success: string;
  warning: string;
  warningSurface: string;
  danger: string;
  dangerSurface: string;
  info: string;
  black: string;
  white: string;
}

// Светлая палитра (PDR §8.2).
export const lightColors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F5',
  textPrimary: '#101828',
  textSecondary: '#667085',
  textMuted: '#98A2B3',
  border: '#E4E7EC',
  primary: '#2563EB',
  primaryPressed: '#1D4ED8',
  success: '#16A34A',
  warning: '#B45309',
  warningSurface: '#FFFBEB',
  danger: '#DC2626',
  dangerSurface: '#FEF2F2',
  info: '#0EA5E9',
  black: '#000000',
  white: '#FFFFFF',
} as const satisfies IColors;

// Тёмная палитра (PDR §8.2): тёплый нейтральный фон, не чистый чёрный; primaryPressed — производное.
export const darkColors = {
  background: '#1C1C1E',
  surface: '#2C2C2E',
  surfaceMuted: '#3A3A3C',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.65)',
  textMuted: 'rgba(235,235,245,0.35)',
  border: 'rgba(255,255,255,0.10)',
  primary: '#5B8DEF',
  primaryPressed: '#4A7BE0',
  success: '#34D399',
  warning: '#FBBF24',
  warningSurface: 'rgba(251,191,36,0.18)',
  danger: '#F87171',
  dangerSurface: 'rgba(248,113,113,0.18)',
  info: '#60A5FA',
  black: '#000000',
  white: '#FFFFFF',
} as const satisfies IColors;

export interface IOrderStatusColor {
  background: string;
  text: string;
}

export interface IOrderStatusColors {
  New: IOrderStatusColor;
  InProgress: IOrderStatusColor;
  Done: IOrderStatusColor;
  Cancelled: IOrderStatusColor;
}

// Цвета статусов для светлой темы (PDR §8.3).
export const lightOrderStatusColors = {
  New: { background: '#EFF6FF', text: '#1D4ED8' },
  InProgress: { background: '#FFFBEB', text: '#B45309' },
  Done: { background: '#ECFDF3', text: '#027A48' },
  Cancelled: { background: '#FEF2F2', text: '#B42318' },
} as const satisfies IOrderStatusColors;

// Цвета статусов для тёмной темы (PDR §8.3): полупрозрачный фон + светлый текст.
export const darkOrderStatusColors = {
  New: { background: 'rgba(91,141,239,0.18)', text: '#7EA6F2' },
  InProgress: { background: 'rgba(251,191,36,0.18)', text: '#FBBF24' },
  Done: { background: 'rgba(52,211,153,0.18)', text: '#34D399' },
  Cancelled: { background: 'rgba(248,113,113,0.18)', text: '#F87171' },
} as const satisfies IOrderStatusColors;
