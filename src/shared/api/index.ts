// Публичный API сегмента shared/api (@/shared/api). Business-agnostic транспорт: колбэки авторизации
// регистрирует app-слой через registerAuthBridge (см. auth-bridge.ts).
export { httpClient, toApiError } from './http-client';
export { registerAuthBridge, type IAuthBridge } from './auth-bridge';
export { ApiErrorCodeEnum, type IApiErrorEnvelope } from './types';
