import { formatTimeUntil } from '../formatTimeUntil';

// Фиксированная точка отсчёта: 10:00. Каждый тест передаёт `now` явно — без системных часов.
const NOW = new Date(2026, 0, 1, 10, 0);

describe('formatTimeUntil', () => {
  it('часы и минуты: «через 1ч 30м»', () => {
    expect(formatTimeUntil('11:30', NOW)).toBe('через 1ч 30м');
  });

  it('только минуты (< 1 часа): «через 45м»', () => {
    expect(formatTimeUntil('10:45', NOW)).toBe('через 45м');
  });

  it('ровно час, без минут: «через 1ч»', () => {
    expect(formatTimeUntil('11:00', NOW)).toBe('через 1ч');
  });

  it('прошедшее время (раньше now) → null', () => {
    expect(formatTimeUntil('09:00', NOW)).toBeNull();
  });

  it('время равно now (не строго позже) → null', () => {
    expect(formatTimeUntil('10:00', NOW)).toBeNull();
  });

  it('невалидная строка → null', () => {
    expect(formatTimeUntil('not-a-time', NOW)).toBeNull();
  });
});
