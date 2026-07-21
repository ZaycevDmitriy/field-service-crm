import { getGreeting } from '../get-greeting';

const NIGHT = 'Доброй ночи';

describe('getGreeting', () => {
  it.each([
    { hour: 5, expected: 'Доброе утро' },
    { hour: 11, expected: 'Доброе утро' },
    { hour: 12, expected: 'Добрый день' },
    { hour: 17, expected: 'Добрый день' },
    { hour: 18, expected: 'Добрый вечер' },
    { hour: 22, expected: 'Добрый вечер' },
    { hour: 23, expected: NIGHT },
    { hour: 0, expected: NIGHT },
    { hour: 4, expected: NIGHT },
  ])('час $hour → "$expected"', ({ hour, expected }) => {
    expect(getGreeting(hour)).toBe(expected);
  });
});
