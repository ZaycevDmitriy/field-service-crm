import { formatDistanceLabel, getDistanceInKm, type IGeoPoint } from '@/shared/lib/geo';

// Эталонные гео-точки для проверки гаверсинуса.
const MOSCOW: IGeoPoint = { latitude: 55.7522, longitude: 37.6156 };
const SAINT_PETERSBURG: IGeoPoint = { latitude: 59.9386, longitude: 30.3141 };

describe('getDistanceInKm', () => {
  it('возвращает 0 для совпадающих точек', () => {
    expect(getDistanceInKm(MOSCOW, MOSCOW)).toBeCloseTo(0, 5);
  });

  it.each([
    {
      name: 'Москва — Санкт-Петербург',
      from: MOSCOW,
      to: SAINT_PETERSBURG,
      expectedKm: 633,
      toleranceKm: 5,
    },
    {
      name: 'обратное направление',
      from: SAINT_PETERSBURG,
      to: MOSCOW,
      expectedKm: 633,
      toleranceKm: 5,
    },
  ])('считает $name ≈ $expectedKm км', ({ from, to, expectedKm, toleranceKm }) => {
    // Гаверсинус сверяется с эталоном приближённо: допуск покрывает округление координат.
    expect(Math.abs(getDistanceInKm(from, to) - expectedKm)).toBeLessThanOrEqual(toleranceKm);
  });

  it('симметрична: d(a, b) === d(b, a)', () => {
    expect(getDistanceInKm(MOSCOW, SAINT_PETERSBURG)).toBeCloseTo(
      getDistanceInKm(SAINT_PETERSBURG, MOSCOW),
      10,
    );
  });
});

describe('formatDistanceLabel', () => {
  it.each([
    { distanceKm: 0, expected: '0 м' },
    { distanceKm: 0.35, expected: '350 м' },
    { distanceKm: 0.994, expected: '990 м' },
    { distanceKm: 4.234, expected: '4.2 км' },
    { distanceKm: 11, expected: '11.0 км' },
  ])('форматирует $distanceKm км → "$expected"', ({ distanceKm, expected }) => {
    expect(formatDistanceLabel(distanceKm)).toBe(expected);
  });

  it('округление до 1000 м на границе 1 км переходит в "1.0 км", а не "1000 м"', () => {
    // 0.9996 км округляется до 10 м как 1000 м, но ветка «км» по условию distanceKm < 1 не
    // срабатывает — без фикса функция вернула бы «1000 м».
    expect(formatDistanceLabel(0.9996)).toBe('1.0 км');
  });
});
