// Мост между business-agnostic транспортом (shared/api) и сущностью сессии (entities/session), не
// нарушающий направление импортов FSD (shared не может импортировать entities). Колбэки регистрирует
// app-слой при старте (см. src/app/_layout.tsx), делегируя реализацию в entities/session.
export interface IAuthBridge {
  // Текущий access-токен (синхронно, из in-memory кэша сервиса сессии) или null, если не авторизован.
  getAccessToken: () => string | null;
  // Обновление токенов (single-flight на стороне entities/session). Бросает при сбое/таймауте.
  refreshSession: () => Promise<void>;
  // Вызывается, когда сессия окончательно недействительна (повторный 401 после успешного refresh).
  onSessionExpired: () => void;
}

// Заглушка до регистрации моста — не должна вызываться раньше bootstrap-эффекта в _layout.tsx.
const noopAuthBridge: IAuthBridge = {
  getAccessToken: () => null,
  refreshSession: () => Promise.reject(new Error('AuthBridge не зарегистрирован.')),
  onSessionExpired: () => {},
};

let authBridge: IAuthBridge = noopAuthBridge;

export const registerAuthBridge = (bridge: IAuthBridge): void => {
  authBridge = bridge;
};

export const getAccessToken = (): string | null => authBridge.getAccessToken();

export const refreshSession = (): Promise<void> => authBridge.refreshSession();

export const onSessionExpired = (): void => authBridge.onSessionExpired();
