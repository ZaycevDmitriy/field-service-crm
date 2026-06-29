import { resolveButtonColors } from '../button';

import { darkColors, lightColors } from '@/shared/config';

// Регрессия на дефект «secondary-кнопка сливается с карточкой»: заливка варианта secondary обязана
// отличаться от surface (цвет Card, на которой кнопка живёт) — иначе единственный разделитель —
// hairline-граница 1.24:1, и кнопка визуально неотличима от контейнера. Тест привязан к самому
// резолверу варианта, поэтому ловит ревёрт заливки обратно на colors.surface.
describe('Button — заливка вариантов', () => {
  describe('secondary не сливается с surface-карточкой', () => {
    it.each([
      { theme: 'light', colors: lightColors },
      { theme: 'dark', colors: darkColors },
    ])('$theme: фон secondary ≠ surface и равен surfaceMuted', ({ colors }) => {
      const { background } = resolveButtonColors('secondary', colors, false);

      expect(background).not.toBe(colors.surface);
      expect(background).toBe(colors.surfaceMuted);
    });
  });
});
