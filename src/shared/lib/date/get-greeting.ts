// Приветствие по времени суток: ночь 23–4, утро 5–11, день 12–17, вечер 18–22.
export function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return 'Доброе утро';
  }
  if (hour >= 12 && hour < 18) {
    return 'Добрый день';
  }
  if (hour >= 18 && hour < 23) {
    return 'Добрый вечер';
  }
  return 'Доброй ночи';
}
