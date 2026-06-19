import { formatDistanceLabel } from './formatDistanceLabel';
import { getDistanceInKm, type IGeoPoint } from './getDistanceInKm';

// Тест-задел Phase 6. Раннер (jest) вводится в Phase 9 (PDR §22), поэтому здесь — таблицы кейсов
// и чистые прогоны БЕЗ jest-глобалов (`describe`/`it`/`expect`): `npm run check` остаётся зелёным
// без `@types/jest`. В Phase 9 кейсы оборачиваются в `it.each`, а ручные сравнения заменяются на
// `expect(...).toBeCloseTo(...)` / `toBe(...)`.

interface IDistanceCase {
  name: string;
  from: IGeoPoint;
  to: IGeoPoint;
  expectedKm: number;
  // Допустимое отклонение (км): гаверсинус сверяется с эталонными значениями приближённо.
  toleranceKm: number;
}

// Эталонные точки.
const MOSCOW: IGeoPoint = { latitude: 55.7522, longitude: 37.6156 };
const SAINT_PETERSBURG: IGeoPoint = { latitude: 59.9386, longitude: 30.3141 };

export const GEO_DISTANCE_CASES: IDistanceCase[] = [
  {
    name: 'нулевая дистанция между совпадающими точками',
    from: MOSCOW,
    to: MOSCOW,
    expectedKm: 0,
    toleranceKm: 0.001,
  },
  {
    name: 'Москва — Санкт-Петербург ≈ 633 км',
    from: MOSCOW,
    to: SAINT_PETERSBURG,
    expectedKm: 633,
    toleranceKm: 5,
  },
  {
    name: 'симметричность: дистанция не зависит от направления',
    from: SAINT_PETERSBURG,
    to: MOSCOW,
    expectedKm: 633,
    toleranceKm: 5,
  },
];

interface ILabelCase {
  distanceKm: number;
  expected: string;
}

export const GEO_LABEL_CASES: ILabelCase[] = [
  { distanceKm: 0, expected: '0 м' },
  { distanceKm: 0.35, expected: '350 м' },
  { distanceKm: 4.234, expected: '4.2 км' },
  { distanceKm: 11, expected: '11.0 км' },
];

export interface IGeoCaseFailure {
  name: string;
  expected: string;
  actual: string;
}

/**
 * Прогоняет таблицы кейсов и возвращает список расхождений (пустой массив = все кейсы сошлись).
 * Использует обе утилиты сегмента — служит исполняемым заделом до подключения раннера.
 */
export function runGeoCases(): IGeoCaseFailure[] {
  const failures: IGeoCaseFailure[] = [];

  for (const testCase of GEO_DISTANCE_CASES) {
    const actual = getDistanceInKm(testCase.from, testCase.to);
    if (Math.abs(actual - testCase.expectedKm) > testCase.toleranceKm) {
      failures.push({
        name: testCase.name,
        expected: `${testCase.expectedKm} ± ${testCase.toleranceKm} км`,
        actual: `${actual.toFixed(3)} км`,
      });
    }
  }

  for (const labelCase of GEO_LABEL_CASES) {
    const actual = formatDistanceLabel(labelCase.distanceKm);
    if (actual !== labelCase.expected) {
      failures.push({
        name: `formatDistanceLabel(${labelCase.distanceKm})`,
        expected: labelCase.expected,
        actual,
      });
    }
  }

  return failures;
}
