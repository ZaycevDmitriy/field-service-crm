// Утилита контраста (WCAG 2.1) — общая для theme-контраста и контраста статусных токенов заявки
// (entities/order). Считает относительную яркость и contrast ratio; полупрозрачные rgba-токены (в
// тёмной теме — *Surface, статус-плашки, textSecondary/textMuted) композитятся на непрозрачную
// подложку перед замером, иначе альфа парсилась бы как непрозрачный цвет и контраст вышел бы неверным.

export interface IRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface IRgb {
  r: number;
  g: number;
  b: number;
}

// Парсит '#rrggbb' / '#rgb' / 'rgb(...)' / 'rgba(...)' в каналы 0–255 и альфу 0–1.
export function parseColor(input: string): IRgba {
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
export function contrastRatio(fg: string, bg: string, base = '#FFFFFF'): number {
  const baseColor = parseColor(base);
  const baseRgb: IRgb = { r: baseColor.r, g: baseColor.g, b: baseColor.b };
  const bgRgb = flatten(parseColor(bg), baseRgb);
  const fgRgb = flatten(parseColor(fg), bgRgb);
  const lighter = Math.max(luminance(fgRgb), luminance(bgRgb));
  const darker = Math.min(luminance(fgRgb), luminance(bgRgb));

  return (lighter + 0.05) / (darker + 0.05);
}

// Пороги WCAG 2.1 AA: обычный текст ≥4.5, нетекстовые элементы (иконки/границы/рейлы) ≥3.
export const TEXT_MIN = 4.5;
export const NON_TEXT_MIN = 3;
// Порог «не-слияния»: тональный филл контрола должен оставаться отделим от поверхности-контейнера.
// Это affordance-guard (контрол не сливается с фоном), а не WCAG-порог — светлый нейтральный филл
// строгие 3:1 не даёт; ловит регрессию вида surfaceMuted→surface (отрыв схлопывается до 1.0).
export const SEPARATION_MIN = 1.1;

export interface IContrastPair {
  label: string;
  fg: string;
  bg: string;
  // Непрозрачная подложка под bg (нужна для полупрозрачных rgba-токенов тёмной темы).
  base?: string;
  min: number;
}
