import { formatScheduledSlot } from '../format-scheduled-slot';

describe('formatScheduledSlot', () => {
  it('форматирует пару ISO-строк в "HH:mm — HH:mm" (em-dash с пробелами)', () => {
    expect(formatScheduledSlot('2026-01-02T09:00:00.000Z', '2026-01-02T10:00:00.000Z')).toBe(
      '09:00 — 10:00',
    );
  });

  it('слот в пределах одного часа форматируется без потери минут', () => {
    expect(formatScheduledSlot('2026-01-02T09:15:00.000Z', '2026-01-02T09:45:00.000Z')).toBe(
      '09:15 — 09:45',
    );
  });
});
