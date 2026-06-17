import type { ViewStyle } from 'react-native';

// Мягкая тень карточки через boxShadow (New Architecture; PDR §9.4).
// boxShadow требует New Arch и Android 9+ для outset-теней — для портфолио-MVP приемлемо.
// На тёмной теме тень слабозаметна — допустимо для MVP.
export const Shadows = {
  card: {
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 8, spreadDistance: 0, color: 'rgba(0,0,0,0.08)' },
    ],
  },
  // Усиленная тень для hero-карточки (тяжелее карточной): больше смещение, размытие и насыщенность.
  hero: {
    boxShadow: [
      { offsetX: 0, offsetY: 8, blurRadius: 24, spreadDistance: 0, color: 'rgba(0,0,0,0.12)' },
    ],
  },
} satisfies Record<'card' | 'hero', ViewStyle>;
