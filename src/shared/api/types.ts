// Коды ошибок API (конверт бэкенда {code, message, details?}, onsite-backend/openapi.json) + один
// синтетический клиентский код для сетевых сбоёв. Const-object + производный тип вместо TS enum (PDR §6).
export const ApiErrorCodeEnum = {
  ValidationFailed: 'validation_failed',
  NotFound: 'not_found',
  Unauthorized: 'unauthorized',
  Forbidden: 'forbidden',
  Conflict: 'conflict',
  InvalidTransition: 'invalid_transition',
  InvalidCredentials: 'invalid_credentials',
  TooManyAttempts: 'too_many_attempts',
  EmailTaken: 'email_taken',
  BadRequest: 'bad_request',
  InternalError: 'internal_error',
  FileTooLarge: 'file_too_large',
  UnsupportedMediaType: 'unsupported_media_type',
  // Синтетический код: запрос не дошёл до сервера или превышен таймаут (нет ответа для нормализации).
  NetworkError: 'network_error',
} as const;
export type ApiErrorCodeEnum = (typeof ApiErrorCodeEnum)[keyof typeof ApiErrorCodeEnum];

// Единый конверт ошибки API — как ответ сервера, так и нормализованный клиентский сбой (см. toApiError).
export interface IApiErrorEnvelope {
  code: ApiErrorCodeEnum;
  message: string;
  details?: unknown;
}
