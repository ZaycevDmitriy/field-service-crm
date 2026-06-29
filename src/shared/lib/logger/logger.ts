// Логгер приложения. `console.error` / `console.warn` рисуют LogBox-плашку поверх UI в dev и бесполезны
// пользователю в release, поэтому здесь НЕ используются: вся диагностика идёт через `console.log` (LogBox
// его не перехватывает) и только в `__DEV__`. Пользователю об ошибке сообщает UI (ErrorState/Alert/инлайн),
// логгер — исключительно для разработчика; полный объект ошибки попадает в консоль лишь в dev-сборке.

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Единая точка вывода: пишем только в dev и только через `console.log` — без LogBox-плашки.
function devLog(level: LogLevel, args: readonly unknown[]): void {
  if (__DEV__) {
    console.log(`[${level}]`, ...args);
  }
}

export const logger = {
  debug: (...args: unknown[]): void => devLog('DEBUG', args),
  info: (...args: unknown[]): void => devLog('INFO', args),
  warn: (...args: unknown[]): void => devLog('WARN', args),
  error: (...args: unknown[]): void => devLog('ERROR', args),
};
