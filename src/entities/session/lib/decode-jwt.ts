// Payload JWT, нужный клиенту (onsite-backend подписывает access-токен RS256). Подпись НЕ проверяется
// (клиент не располагает секретом/публичным ключом верификации в рантайме) — декод используется только
// как подсказка (exp — истёк ли токен), сервер остаётся источником истины авторизации.
export interface IJwtPayload {
  sub: string;
  role: string;
  exp: number;
}

// base64url (JWT-алфавит: `-`/`_`, без padding) → стандартный base64 для `atob`.
const base64UrlToBase64 = (segment: string): string => {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (base64.length % 4)) % 4;

  return base64 + '='.repeat(paddingLength);
};

// Декодирует payload JWT на встроенном `atob` (RN 0.74+), без внешней библиотеки. Битый/неполный
// токен или payload с неожиданной формой (валидация на границе, PDR-правило) → null, не исключение.
export const decodeJwtPayload = (token: string): IJwtPayload | null => {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) {
      return null;
    }

    const decoded = JSON.parse(atob(base64UrlToBase64(payloadSegment))) as Partial<IJwtPayload>;

    if (
      typeof decoded.sub !== 'string' ||
      typeof decoded.role !== 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      return null;
    }

    return { sub: decoded.sub, role: decoded.role, exp: decoded.exp };
  } catch {
    return null;
  }
};
