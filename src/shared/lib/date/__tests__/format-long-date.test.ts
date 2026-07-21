import { formatLongDate } from '../format-long-date';

describe('formatLongDate', () => {
  // ISO-вход, стабильный ожидаемый вывод; Node-тест не доказывает поведение Hermes ICU на устройстве
  // (см. комментарий formatScheduledTime про hourCycle) — здесь только фиксируем текущий контракт.
  it('форматирует дату в "день недели, число месяц"', () => {
    expect(formatLongDate(new Date(Date.UTC(2026, 0, 2, 9, 5)))).toBe('пятница, 2 января');
  });

  it('однозначное число месяца — без ведущего нуля', () => {
    expect(formatLongDate(new Date(Date.UTC(2026, 4, 4, 9, 5)))).toBe('понедельник, 4 мая');
  });
});
