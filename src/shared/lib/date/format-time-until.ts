// Парсит время вида 'HH:mm' в минуты от полуночи; некорректный ввод → null (по образцу getNearestOrder.toMinutes,
// но с явным null вместо +Infinity — здесь некорректный ввод не должен участвовать в сортировке).
const parseMinutes = (time: string): number | null => {
  const [hours, minutes] = time.split(':');
  const h = Number(hours);
  const m = Number(minutes);

  if (Number.isNaN(h) || Number.isNaN(m)) {
    return null;
  }

  return h * 60 + m;
};

/**
 * Человекочитаемый интервал до `scheduledTime` ('HH:mm') от текущего момента: «через 1ч 30м»,
 * «через 45м», «через 2ч». Прошедшее время (`scheduledTime` не позже `now`) или невалидная строка —
 * `null` (вызывающий код решает, что показать вместо интервала).
 */
export const formatTimeUntil = (scheduledTime: string, now: Date = new Date()): string | null => {
  const scheduledMinutes = parseMinutes(scheduledTime);
  if (scheduledMinutes === null) {
    return null;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = scheduledMinutes - nowMinutes;
  if (diff <= 0) {
    return null;
  }

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (hours === 0) {
    return `через ${minutes}м`;
  }
  if (minutes === 0) {
    return `через ${hours}ч`;
  }

  return `через ${hours}ч ${minutes}м`;
};
