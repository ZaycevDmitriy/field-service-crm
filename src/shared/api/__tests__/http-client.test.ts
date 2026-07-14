import { isAuthEndpoint, toApiError } from '../http-client';
import { ApiErrorCodeEnum, type IApiErrorEnvelope } from '../types';

// Минимальный axios-подобный объект ошибки: isAxiosError() из axios проверяет флаг isAxiosError
// на самом объекте, полноценный AxiosError для юнит-теста не нужен.
const makeAxiosError = (data?: unknown): unknown =>
  Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    ...(data !== undefined ? { response: { status: 401, data } } : {}),
  });

describe('toApiError', () => {
  it('пропускает уже нормализованный конверт как есть (идемпотентность, реджект refreshSession)', () => {
    const envelope: IApiErrorEnvelope = {
      code: ApiErrorCodeEnum.Unauthorized,
      message: 'Refresh-токен недействителен.',
    };

    expect(toApiError(envelope)).toBe(envelope);
  });

  it('нормализует ответ сервера с {code, message} в конверт', () => {
    const error = makeAxiosError({
      code: ApiErrorCodeEnum.InvalidCredentials,
      message: 'Неверные учётные данные.',
    });

    expect(toApiError(error)).toEqual({
      code: ApiErrorCodeEnum.InvalidCredentials,
      message: 'Неверные учётные данные.',
    });
  });

  it('сетевой сбой без ответа сервера → синтетический network_error', () => {
    expect(toApiError(makeAxiosError()).code).toBe(ApiErrorCodeEnum.NetworkError);
  });

  it('ответ сервера не в форме конверта (HTML от прокси и т.п.) → network_error', () => {
    expect(toApiError(makeAxiosError('<html>502 Bad Gateway</html>')).code).toBe(
      ApiErrorCodeEnum.NetworkError,
    );
  });

  it('не-axios ошибка (нативный сбой) → network_error', () => {
    expect(toApiError(new Error('Keychain unavailable')).code).toBe(ApiErrorCodeEnum.NetworkError);
  });
});

describe('isAuthEndpoint', () => {
  it.each(['/v1/auth/login', '/v1/auth/refresh', '/v1/auth/logout'])(
    'распознаёт auth-эндпоинт %s',
    (url) => {
      expect(isAuthEndpoint(url)).toBe(true);
    },
  );

  it('матчит путь с query-строкой', () => {
    expect(isAuthEndpoint('/v1/auth/login?redirect=1')).toBe(true);
  });

  it('НЕ матчит путь с auth-префиксом, но другим хвостом (точный суффикс, не подстрока)', () => {
    expect(isAuthEndpoint('/v1/auth/login-history')).toBe(false);
  });

  it('обычный эндпоинт и undefined — не auth', () => {
    expect(isAuthEndpoint('/v1/orders')).toBe(false);
    expect(isAuthEndpoint(undefined)).toBe(false);
  });
});
