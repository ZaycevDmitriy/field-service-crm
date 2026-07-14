// Форматтер короткого времени визита из канонического ISO 8601 (scheduledAt) в отображаемую
// строку вида '09:00' — формат 1:1 с прежним локальным scheduledTime (см. фикстуры
// order-database-service.test.ts). Локальная таймзона устройства (без явного timeZone) — поэтому
// юнит-тесты детерминированы только при фиксированной таймзоне процесса (`npm test` = `TZ=UTC jest`).
// hourCycle: 'h23' явно (не hour12: false): hour12 в разных ICU/движках может резолвиться в h24 —
// полночь стала бы '24:05'; рантайм устройства (Hermes) и Node в тестах используют разные ICU.
const scheduledTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Форматирует ISO-строку (scheduledAt) в короткое время визита, напр. '09:00'.
export function formatScheduledTime(iso: string): string {
  return scheduledTimeFormatter.format(new Date(iso));
}
