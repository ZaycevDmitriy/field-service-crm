// Форматтер даты-времени для строки «Последняя проверка»: «Сегодня/Вчера, HH:mm» либо «4 мая, HH:mm».
const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

const dayMonthFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

// Сравнение по календарному дню (год/месяц/число) в локальной зоне.
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Форматирует дату в строку «Сегодня, 10:42» / «Вчера, 10:42» / «4 мая, 10:42».
export function formatDateTime(date: Date): string {
  const now = new Date();
  const time = timeFormatter.format(date);

  if (isSameDay(date, now)) {
    return `Сегодня, ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return `Вчера, ${time}`;
  }

  return `${dayMonthFormatter.format(date)}, ${time}`;
}
