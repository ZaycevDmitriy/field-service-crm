import {
  darkColors,
  darkOrderStatusColors,
  lightColors,
  lightOrderStatusColors,
  type IColors,
  type IOrderStatusColors,
} from '../colors';

// Утилита контраста (WCAG 2.1) инлайн в тесте: единственный потребитель — этот сьют. Считает
// относительную яркость и contrast ratio; полупрозрачные rgba-токены (в тёмной теме — *Surface,
// статус-плашки, textSecondary/textMuted) композитятся на непрозрачную подложку перед замером,
// иначе альфа парсилась бы как непрозрачный цвет и контраст вышел бы неверным.

interface IRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface IRgb {
  r: number;
  g: number;
  b: number;
}

// Парсит '#rrggbb' / '#rgb' / 'rgb(...)' / 'rgba(...)' в каналы 0–255 и альфу 0–1.
function parseColor(input: string): IRgba {
  const value = input.trim();
  if (value.startsWith('#')) {
    const raw = value.slice(1);
    const hex =
      raw.length === 3
        ? raw
            .split('')
            .map((c) => c + c)
            .join('')
        : raw;

    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  const match = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) {
    throw new Error(`Не удалось разобрать цвет: ${input}`);
  }
  const parts = match[1].split(',').map((part) => Number(part.trim()));

  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
}

// Композитит цвет с альфой поверх непрозрачной подложки (alpha-over).
function flatten(fg: IRgba, bg: IRgb): IRgb {
  if (fg.a >= 1) {
    return { r: fg.r, g: fg.g, b: fg.b };
  }
  const { a } = fg;

  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}

// Линеаризация sRGB-канала (WCAG).
function linearize(channel: number): number {
  const s = channel / 255;

  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// Относительная яркость (WCAG).
function luminance(rgb: IRgb): number {
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

// Контраст переднего цвета на фоне. base — непрозрачная подложка под bg (нужна для полупрозрачных
// rgba-токенов тёмной темы). По умолчанию белая.
function contrastRatio(fg: string, bg: string, base = '#FFFFFF'): number {
  const baseColor = parseColor(base);
  const baseRgb: IRgb = { r: baseColor.r, g: baseColor.g, b: baseColor.b };
  const bgRgb = flatten(parseColor(bg), baseRgb);
  const fgRgb = flatten(parseColor(fg), bgRgb);
  const lighter = Math.max(luminance(fgRgb), luminance(bgRgb));
  const darker = Math.min(luminance(fgRgb), luminance(bgRgb));

  return (lighter + 0.05) / (darker + 0.05);
}

// Пороги WCAG 2.1 AA: обычный текст ≥4.5, нетекстовые элементы (иконки/границы/рейлы) ≥3.
const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;

interface IContrastPair {
  label: string;
  fg: string;
  bg: string;
  // Непрозрачная подложка под bg (нужна для полупрозрачных rgba-токенов тёмной темы).
  base?: string;
  min: number;
}

// Полная матрица контрастных пар для одной темы (значения берутся из реальных токенов).
function buildPairs(c: IColors, status: IOrderStatusColors): IContrastPair[] {
  const statusPairs = (Object.keys(status) as (keyof IOrderStatusColors)[]).map((key) => ({
    label: `status ${key} text / plate`,
    fg: status[key].text,
    bg: status[key].background,
    base: c.surface,
    min: TEXT_MIN,
  }));

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
    ...statusPairs,
  ];
}

// Регистрирует it-проверки матрицы внутри текущего describe-блока темы.
function runMatrix(colors: IColors, status: IOrderStatusColors): void {
  it.each(buildPairs(colors, status))('$label ≥ $min', (pair) => {
    expect(contrastRatio(pair.fg, pair.bg, pair.base)).toBeGreaterThanOrEqual(pair.min);
  });
}

describe('Контраст токенов темы (WCAG AA)', () => {
  describe('light', () => {
    runMatrix(lightColors, lightOrderStatusColors);
  });
  describe('dark', () => {
    runMatrix(darkColors, darkOrderStatusColors);
  });

  it('photo-ghost (фикс-цвет CAMERA, theme-independent) ≥ 4.5 на тёмном фоне', () => {
    // photo-capture-view.tsx: экран намеренно theme-independent — ghost-действие использует фикс
    // CAMERA.action (#8AB0F5) на CAMERA.bg (#0b0d10), а не токен темы. Дублируем литералы как контракт.
    expect(contrastRatio('#8AB0F5', '#0b0d10')).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});
