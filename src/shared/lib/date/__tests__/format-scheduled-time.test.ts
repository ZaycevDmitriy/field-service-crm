import { formatScheduledTime } from '../format-scheduled-time';

describe('formatScheduledTime', () => {
  it('форматирует ISO-строку в HH:mm (двузначные часы и минуты)', () => {
    expect(formatScheduledTime('2026-01-02T09:00:00.000Z')).toBe('09:00');
  });

  it('полночь форматируется как 00:mm, не 24:mm', () => {
    expect(formatScheduledTime('2026-01-02T00:05:00.000Z')).toBe('00:05');
  });

  it('время без ведущего нуля в минутах дополняется нулём', () => {
    expect(formatScheduledTime('2026-01-02T14:05:00.000Z')).toBe('14:05');
  });
});
