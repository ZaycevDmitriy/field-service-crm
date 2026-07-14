import { formatScheduledTime } from './format-scheduled-time';

// Форматтер временного слота визита из канонических ISO 8601 (slotStart/slotEnd) в отображаемую
// строку вида '12:00 — 13:00' (формат 1:1 с прежним локальным scheduledSlot — em-dash с пробелами
// вокруг, см. фикстуры order-database-service.test.ts).
export function formatScheduledSlot(startIso: string, endIso: string): string {
  return `${formatScheduledTime(startIso)} — ${formatScheduledTime(endIso)}`;
}
