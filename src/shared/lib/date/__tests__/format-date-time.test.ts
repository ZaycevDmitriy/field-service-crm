import { formatDateTime } from '../format-date-time';

// formatDateTime берёт «сегодня» из системных часов (new Date()) — фиксируем их фейковыми таймерами,
// иначе «Сегодня»/«Вчера» плавали бы вместе с датой прогона теста.
const NOW = new Date(Date.UTC(2026, 0, 15, 12, 0));

describe('formatDateTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('дата совпадает с сегодняшней → "Сегодня, HH:mm"', () => {
    expect(formatDateTime(new Date(Date.UTC(2026, 0, 15, 9, 5)))).toBe('Сегодня, 09:05');
  });

  it('дата — вчерашняя (тот же час) → "Вчера, HH:mm"', () => {
    expect(formatDateTime(new Date(Date.UTC(2026, 0, 14, 9, 5)))).toBe('Вчера, 09:05');
  });

  it('дата раньше вчерашней → "D month, HH:mm" (Node-тест не доказывает поведение Hermes ICU)', () => {
    expect(formatDateTime(new Date(Date.UTC(2026, 0, 2, 9, 5)))).toBe('2 января, 09:05');
  });
});
