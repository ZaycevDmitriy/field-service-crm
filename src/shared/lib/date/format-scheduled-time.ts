// Форматтер короткого времени визита из канонического ISO 8601 (scheduledAt) в отображаемую
// строку вида '09:00' — формат 1:1 с прежним локальным scheduledTime (см. фикстуры
// order-database-service.test.ts). Локальная таймзона устройства (без явного timeZone) — поэтому
// юнит-тесты детерминированы только при фиксированной таймзоне процесса (`npm test` = `TZ=UTC jest`).
const scheduledTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// Форматирует ISO-строку (scheduledAt) в короткое время визита, напр. '09:00'.
export function formatScheduledTime(iso: string): string {
  return scheduledTimeFormatter.format(new Date(iso));
}
