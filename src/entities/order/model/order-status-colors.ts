// Цвета статусов заявки — доменная концепция order (ServiceOrderStatusEnum), а не тема приложения.
// Перенесены сюда из shared/config/theme (PDR §8.3): shared business-agnostic, не должен знать про
// домен заявок (FSD-lite, см. CLAUDE.md). Значения не менялись при переносе.
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

// Цвета статусов для тёмной темы (PDR §8.3): полупрозрачный фон + светлый текст. New/Cancelled
// осветлены до WCAG AA (≥4.5) на своей 0.18-плашке (было 4.44 / 3.83).
export const darkOrderStatusColors = {
  New: { background: 'rgba(91,141,239,0.18)', text: '#8AB0F5' },
  InProgress: { background: 'rgba(251,191,36,0.18)', text: '#FBBF24' },
  Done: { background: 'rgba(52,211,153,0.18)', text: '#34D399' },
  Cancelled: { background: 'rgba(248,113,113,0.18)', text: '#FCA5A5' },
} as const satisfies IOrderStatusColors;
