// Роль пользователя (onsite-backend/openapi.json: /v1/auth/login). Const-object + производный тип
// вместо TS enum (PDR §6).
export const UserRoleEnum = {
  Dispatcher: 'dispatcher',
  Technician: 'technician',
} as const;
export type UserRoleEnum = (typeof UserRoleEnum)[keyof typeof UserRoleEnum];

// Человекочитаемые подписи ролей (секция «Аккаунт» в настройках).
export const UserRoleLabel: Record<UserRoleEnum, string> = {
  [UserRoleEnum.Dispatcher]: 'Диспетчер',
  [UserRoleEnum.Technician]: 'Техник',
};

// Пользователь сессии — минимальный набор полей, нужный клиенту в Phase 10 (id, email, role,
// displayName). Остальные поля ответа логина (isActive, createdAt) в домен пока не введены.
export interface IUser {
  id: string;
  email: string;
  role: UserRoleEnum;
  displayName: string;
}

// Статус сессии: `unknown` — до завершения restoreSession() при старте (сплэш не скрывается, PDR
// «Решения дизайна» Phase 10), `authenticated`/`unauthenticated` — после.
export const SessionStatusEnum = {
  Unknown: 'unknown',
  Authenticated: 'authenticated',
  Unauthenticated: 'unauthenticated',
} as const;
export type SessionStatusEnum = (typeof SessionStatusEnum)[keyof typeof SessionStatusEnum];
