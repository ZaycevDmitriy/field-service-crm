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
  danger: string;
  info: string;
  black: string;
  white: string;
}

export const Colors = {
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
  warning: '#F59E0B',
  danger: '#DC2626',
  info: '#0EA5E9',
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

export const OrderStatusColors = {
  New: { background: '#EFF6FF', text: '#1D4ED8' },
  InProgress: { background: '#FFFBEB', text: '#B45309' },
  Done: { background: '#ECFDF3', text: '#027A48' },
  Cancelled: { background: '#FEF2F2', text: '#B42318' },
} as const satisfies IOrderStatusColors;
