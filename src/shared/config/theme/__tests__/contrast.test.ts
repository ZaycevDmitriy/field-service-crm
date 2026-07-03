import { darkColors, lightColors, type IColors } from '../colors';

import {
  contrastRatio,
  NON_TEXT_MIN,
  SEPARATION_MIN,
  TEXT_MIN,
  type IContrastPair,
} from './helpers/contrast';

// Полная матрица контрастных пар для одной темы (значения берутся из реальных токенов IColors).
// Контраст статусных токенов заявки (IOrderStatusColors) — отдельный сьют в entities/order/model
// (shared не может импортировать entities).
function buildPairs(c: IColors): IContrastPair[] {
  return [
    // White-safe заливки кнопок (белый текст на заливке).
    { label: 'white / primary (btn fill)', fg: c.white, bg: c.primary, min: TEXT_MIN },
    {
      label: 'white / primaryPressed (btn fill)',
      fg: c.white,
      bg: c.primaryPressed,
      min: TEXT_MIN,
    },
    { label: 'white / danger (btn fill)', fg: c.white, bg: c.danger, min: TEXT_MIN },
    // Текстовые токены на поверхностях (плейсхолдеры/счётчики/вторичный текст).
    { label: 'textSecondary / surface', fg: c.textSecondary, bg: c.surface, min: TEXT_MIN },
    {
      label: 'textSecondary / surfaceMuted (neutral badge)',
      fg: c.textSecondary,
      bg: c.surfaceMuted,
      min: TEXT_MIN,
    },
    { label: 'textMuted / surface (placeholder)', fg: c.textMuted, bg: c.surface, min: TEXT_MIN },
    {
      label: 'textMuted / surfaceMuted (placeholder/search)',
      fg: c.textMuted,
      bg: c.surfaceMuted,
      min: TEXT_MIN,
    },
    // accent «на поверхности»: текст (tab-label) ≥4.5, нетекст (иконки/rail/dot) ≥3.
    { label: 'accent / surface (text)', fg: c.accent, bg: c.surface, min: TEXT_MIN },
    { label: 'accent / surfaceMuted (icon tile)', fg: c.accent, bg: c.surfaceMuted, min: TEXT_MIN },
    { label: 'accent / background (non-text)', fg: c.accent, bg: c.background, min: NON_TEXT_MIN },
    // dangerAccent «на поверхности»: danger-текст (update-status-hint, order-details, toast).
    { label: 'dangerAccent / surface (text)', fg: c.dangerAccent, bg: c.surface, min: TEXT_MIN },
    // Бейджи/тосты tinted: насыщенный текст на *Surface (подложка surface для rgba тёмной темы).
    {
      label: 'badge info text / infoSurface',
      fg: c.info,
      bg: c.infoSurface,
      base: c.surface,
      min: TEXT_MIN,
    },
    {
      label: 'badge success text / successSurface',
      fg: c.success,
      bg: c.successSurface,
      base: c.surface,
      min: TEXT_MIN,
    },
    {
      label: 'badge warning text / warningSurface',
      fg: c.warning,
      bg: c.warningSurface,
      base: c.surface,
      min: TEXT_MIN,
    },
    {
      label: 'badge danger text (dangerAccent) / dangerSurface',
      fg: c.dangerAccent,
      bg: c.dangerSurface,
      base: c.surface,
      min: TEXT_MIN,
    },
    {
      label: 'badge neutral text / surfaceMuted',
      fg: c.textSecondary,
      bg: c.surfaceMuted,
      min: TEXT_MIN,
    },
    // error-state/toast: danger-иконка на dangerSurface (нетекст).
    {
      label: 'dangerAccent icon / dangerSurface (non-text)',
      fg: c.dangerAccent,
      bg: c.dangerSurface,
      base: c.surface,
      min: NON_TEXT_MIN,
    },
    // secondary-кнопка (button.tsx): тональный филл surfaceMuted обязан оставаться отделим от
    // surface-карточки, на которой кнопка живёт. Ловит регрессию surface-заливки (слияние 1.0:1).
    {
      label: 'secondary btn fill (surfaceMuted) / surface card (non-collapse)',
      fg: c.surfaceMuted,
      bg: c.surface,
      min: SEPARATION_MIN,
    },
  ];
}

// Регистрирует it-проверки матрицы внутри текущего describe-блока темы.
function runMatrix(colors: IColors): void {
  it.each(buildPairs(colors))('$label ≥ $min', (pair) => {
    expect(contrastRatio(pair.fg, pair.bg, pair.base)).toBeGreaterThanOrEqual(pair.min);
  });
}

describe('Контраст токенов темы (WCAG AA)', () => {
  describe('light', () => {
    runMatrix(lightColors);
  });
  describe('dark', () => {
    runMatrix(darkColors);
  });

  it('photo-ghost (фикс-цвет CAMERA, theme-independent) ≥ 4.5 на тёмном фоне', () => {
    // photo-capture-view.tsx: экран намеренно theme-independent — ghost-действие использует фикс
    // CAMERA.action (#8AB0F5) на CAMERA.bg (#0b0d10), а не токен темы. Дублируем литералы как контракт.
    expect(contrastRatio('#8AB0F5', '#0b0d10')).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});
