import { decodeJwtPayload } from '../decode-jwt';

// base64url (JWT-алфавит) — тестируемый base64UrlToBase64 сам восстанавливает padding по длине,
// поэтому оставшиеся `=` от btoa не мешают и отдельно не срезаются (без regex-квантификатора).
const base64UrlEncode = (input: string): string =>
  btoa(input).replace(/\+/g, '-').replace(/\//g, '_');

const encodeJwt = (payload: unknown): string => {
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));

  return `${header}.${body}.signature`;
};

describe('decodeJwtPayload', () => {
  it('декодирует валидный payload {sub, role, exp}', () => {
    const token = encodeJwt({ sub: 'user-1', role: 'technician', exp: 1999999999 });

    expect(decodeJwtPayload(token)).toEqual({
      sub: 'user-1',
      role: 'technician',
      exp: 1999999999,
    });
  });

  it('возвращает null для строки без сегмента payload', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  it('возвращает null для payload с невалидным base64', () => {
    expect(decodeJwtPayload('header.!!!not-base64!!!.signature')).toBeNull();
  });

  it('возвращает null для payload с некорректным JSON', () => {
    const token = `header.${base64UrlEncode('not-json')}.signature`;

    expect(decodeJwtPayload(token)).toBeNull();
  });

  it('возвращает null, если payload — валидный JSON, но не {sub, role, exp}', () => {
    const token = encodeJwt({ foo: 'bar' });

    expect(decodeJwtPayload(token)).toBeNull();
  });
});
