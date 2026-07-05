// Форматтер длинной даты: «понедельник, 4 мая» (день недели, число, месяц). Регистр задаёт вызывающий.
const longDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

// Форматирует дату в строку вида «понедельник, 4 мая».
export function formatLongDate(date: Date): string {
  return longDateFormatter.format(date);
}
