import { darkOrderStatusColors, lightOrderStatusColors } from '../order-status-colors';
import type { IOrderStatusColors } from '../order-status-colors';

import { darkColors, lightColors } from '@/shared/config';
import { contrastRatio, TEXT_MIN } from '@/shared/config/theme/__tests__/helpers/contrast';

// Контраст статусных токенов заявки (WCAG AA). Живёт в entities/order (не в shared/config/theme):
// IOrderStatusColors — доменная концепция order, а shared business-agnostic не может её импортировать.
function runMatrix(status: IOrderStatusColors, surface: string): void {
  it.each(Object.keys(status) as (keyof IOrderStatusColors)[])(
    'status %s text / plate ≥ 4.5',
    (key) => {
      expect(
        contrastRatio(status[key].text, status[key].background, surface),
      ).toBeGreaterThanOrEqual(TEXT_MIN);
    },
  );
}

describe('Контраст статусных токенов заявки (WCAG AA)', () => {
  describe('light', () => {
    runMatrix(lightOrderStatusColors, lightColors.surface);
  });
  describe('dark', () => {
    runMatrix(darkOrderStatusColors, darkColors.surface);
  });
});
