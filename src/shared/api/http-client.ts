import { create, isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { getAccessToken, onSessionExpired, refreshSession } from './auth-bridge';
import { ApiErrorCodeEnum, isApiErrorEnvelope, type IApiErrorEnvelope } from './types';

import { logger } from '@/shared/lib/logger';

// Dev-фоллбэк для симулятора iOS/web (Android-эмулятор — 10.0.2.2, реальное устройство — LAN IP из
// .env, см. .env.example). Bundle-time переменная (EXPO_PUBLIC_*) — не класть в `extra` (риск R-02,
// затрагивает fingerprint, см. CLAUDE.md).
const DEV_API_URL_FALLBACK = 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 15000;

// Эндпоинты авторизации — на них НЕ навешивается 401-логика single-flight refresh (иначе неверный
// пароль на логине сам запустит refresh, а 401 самого refresh-запроса зациклит цепочку).
const AUTH_ENDPOINT_PATHS = ['/v1/auth/login', '/v1/auth/refresh', '/v1/auth/logout'];

// Точное совпадение пути (без query), не подстрочное: будущий `/v1/auth/login-history` не должен
// случайно матчиться с `/v1/auth/login` и терять 401-логику. Экспорт — только для юнит-тестов,
// в публичный API сегмента (index.ts) не входит.
export const isAuthEndpoint = (url: string | undefined): boolean => {
  const pathname = (url ?? '').split('?')[0];

  return AUTH_ENDPOINT_PATHS.some((path) => pathname.endsWith(path));
};

export const httpClient = create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? DEV_API_URL_FALLBACK,
  timeout: REQUEST_TIMEOUT_MS,
});

// Нормализует ошибку в единый конверт: уже нормализованный конверт — как есть (идемпотентность:
// реджект refreshSession в 401-интерсепторе прошёл нормализацию auth-эндпоинта и не должен
// схлопнуться в network_error); ответ сервера с {code, message} — как есть; сеть/таймаут — network_error.
export const toApiError = (error: unknown): IApiErrorEnvelope => {
  if (isApiErrorEnvelope(error)) {
    return error;
  }

  if (isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (isApiErrorEnvelope(data)) {
      return data;
    }
  }

  return {
    code: ApiErrorCodeEnum.NetworkError,
    message: 'Нет соединения с сервером.',
  };
};

httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isAuthEndpoint(config.url)) {
    return config;
  }

  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

// Внутренний флаг повторной попытки — на самом объекте конфига запроса (аналог originalRequest._retry
// из доки axios), не в общем состоянии клиента: конкурентные запросы не должны видеть чужой флаг.
interface IRetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as IRetriableConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !originalRequest || isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(toApiError(error));
    }

    if (originalRequest._retried) {
      // Повторный 401 уже после успешного refresh — сессия недействительна на сервере (например,
      // деактивация аккаунта). Ретрай не поможет, сбрасываем сессию.
      logger.warn('[http-client] Повторный 401 после refresh — сессия сброшена.');
      onSessionExpired();

      return Promise.reject(toApiError(error));
    }

    originalRequest._retried = true;

    try {
      // Single-flight — на стороне entities/session: конкурентные 401 от разных запросов ждут один
      // и тот же in-flight промис вместо параллельных refresh-запросов.
      await refreshSession();
      const token = getAccessToken();
      if (token) {
        originalRequest.headers.set('Authorization', `Bearer ${token}`);
      }

      return await httpClient(originalRequest);
    } catch (refreshError) {
      // Таймаут/сбой refresh не ретраится (могло уже примениться на сервере) — сессия уже сброшена
      // на стороне entities/session, здесь только уведомляем (тост и т.п.) через onSessionExpired.
      logger.warn('[http-client] Refresh не удался, сессия сброшена.', refreshError);
      onSessionExpired();

      return Promise.reject(toApiError(refreshError));
    }
  },
);
