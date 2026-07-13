import * as SecureStore from 'expo-secure-store';

import { decodeJwtPayload } from '../lib';
import { UserRoleEnum, useSessionStore } from '../model';
import type { IUser } from '../model';

import { httpClient } from '@/shared/api';
import { logger } from '@/shared/lib/logger';

// Ключи SecureStore — три отдельных значения (не один JSON-блоб): исторический лимит iOS Keychain
// ~2048 байт на значение (см. Решения дизайна фазы).
const ACCESS_TOKEN_KEY = 'onsite.accessToken';
const REFRESH_TOKEN_KEY = 'onsite.refreshToken';
const USER_KEY = 'onsite.user';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

interface ILoginResponse {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

interface IRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// Type guard для пользователя, прочитанного из SecureStore (внешний источник, PDR-правило
// «валидация внешних данных на границе»): защищает от ручной правки/повреждения JSON на диске.
const isUser = (value: unknown): value is IUser => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<IUser>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.displayName === 'string' &&
    (candidate.role === UserRoleEnum.Dispatcher || candidate.role === UserRoleEnum.Technician)
  );
};

// In-memory кэш токенов — единственный источник для getAccessToken (нужен http-client'у синхронно,
// SecureStore асинхронен). SecureStore остаётся источником истины между запусками приложения;
// кэш восстанавливается из него в restoreSession().
let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;

// Single-flight refresh: конкурентные вызовы (несколько 401 от параллельных запросов) должны ждать
// один и тот же in-flight промис вместо параллельных refresh-запросов на сервер.
let refreshInFlight: Promise<void> | null = null;

// Синхронный доступ к текущему access-токену — потребитель: auth-bridge (shared/api), см. T7.
export const getAccessToken = (): string | null => currentAccessToken;

// Очищает in-memory кэш, стор и SecureStore. Идемпотентна — безопасна при повторном вызове (второй
// 401 после уже случившегося сброса, logout после сбоя refresh и т.п.).
const clearLocalSessionState = async (): Promise<void> => {
  currentAccessToken = null;
  currentRefreshToken = null;
  useSessionStore.getState().clearSession();

  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
};

// Вход по email/паролю. Ошибки (invalid_credentials, too_many_attempts, network_error — уже
// нормализованные в IApiErrorEnvelope интерсептором shared/api) пробрасываются вызывающему
// (pages/login показывает читаемое сообщение) — здесь не логируются, это ожидаемый пользовательский
// сценарий, а не дефект.
export const login = async (email: string, password: string): Promise<void> => {
  const response = await httpClient.post<ILoginResponse>('/v1/auth/login', { email, password });
  const { accessToken, refreshToken, user } = response.data;

  currentAccessToken = accessToken;
  currentRefreshToken = refreshToken;

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, SECURE_STORE_OPTIONS),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, SECURE_STORE_OPTIONS),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user), SECURE_STORE_OPTIONS),
  ]);

  useSessionStore.getState().setSession(user);
  logger.info('[session-service.login] Вход выполнен.');
};

const performRefresh = async (): Promise<void> => {
  if (!currentRefreshToken) {
    throw new Error('Нет refresh-токена для обновления сессии.');
  }

  const response = await httpClient.post<IRefreshResponse>('/v1/auth/refresh', {
    refreshToken: currentRefreshToken,
  });

  currentAccessToken = response.data.accessToken;
  currentRefreshToken = response.data.refreshToken;

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, currentAccessToken, SECURE_STORE_OPTIONS),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, currentRefreshToken, SECURE_STORE_OPTIONS),
  ]);
};

// Ротация access/refresh пары. Single-flight: повторный вызов, пока первый ещё выполняется, получает
// тот же промис (не дублирует сетевой запрос). Таймаут/сетевой сбой/401 НЕ ретраится (возможно, уже
// применился на сервере — repeated refresh погасил бы всю family) — сессия сбрасывается немедленно.
export const refreshSession = (): Promise<void> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = performRefresh()
    .catch(async (error: unknown) => {
      logger.warn('[session-service.refreshSession] Refresh не удался, сессия сброшена.', error);
      await clearLocalSessionState();
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

// Выход. Локальная сессия чистится немедленно (guard уводит на экран входа независимо от сети);
// отзыв на сервере — best-effort (офлайн не блокирует выход, конверт логаута идемпотентен на 204).
export const logout = async (): Promise<void> => {
  const refreshToken = currentRefreshToken;

  await clearLocalSessionState();
  logger.info('[session-service.logout] Локальная сессия очищена.');

  if (refreshToken) {
    try {
      await httpClient.post('/v1/auth/logout', { refreshToken });
    } catch (error) {
      logger.warn('[session-service.logout] Логаут на сервере не подтверждён (офлайн).', error);
    }
  }
};

// Восстановление сессии при старте приложения: читает SecureStore, при уже истёкшем access
// (по exp из JWT — не бьём лишний раз 401 сразу после cold start) — проактивно обновляет пару.
export const restoreSession = async (): Promise<void> => {
  let accessToken: string | null;
  let refreshToken: string | null;
  let userJson: string | null;

  try {
    [accessToken, refreshToken, userJson] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
  } catch (error) {
    // Нативный сбой Keychain/Keystore не должен навечно оставить статус Unknown (сплэш держится,
    // пока статус не покинет Unknown, см. src/app/_layout.tsx) — трактуем как отсутствие сессии.
    logger.warn('[session-service.restoreSession] SecureStore недоступен, сброс сессии.', error);
    useSessionStore.getState().clearSession();

    return;
  }

  if (!accessToken || !refreshToken || !userJson) {
    logger.info('[session-service.restoreSession] Сессия не найдена, экран входа.');
    useSessionStore.getState().clearSession();

    return;
  }

  let user: IUser;
  try {
    const parsed: unknown = JSON.parse(userJson);
    if (!isUser(parsed)) {
      throw new Error('Некорректная форма пользователя в SecureStore.');
    }
    user = parsed;
  } catch (error) {
    logger.warn(
      '[session-service.restoreSession] Повреждённые данные пользователя, сброс сессии.',
      error,
    );
    await clearLocalSessionState();

    return;
  }

  currentAccessToken = accessToken;
  currentRefreshToken = refreshToken;

  const payload = decodeJwtPayload(accessToken);
  const isExpired = payload ? payload.exp * 1000 <= Date.now() : true;

  if (isExpired) {
    try {
      await refreshSession();
    } catch {
      // refreshSession уже сбросил сессию и залогировал причину.
      return;
    }
  }

  useSessionStore.getState().setSession(user);
  logger.info('[session-service.restoreSession] Сессия восстановлена.');
};
