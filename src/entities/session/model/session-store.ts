import { create } from 'zustand';

import { SessionStatusEnum, type IUser } from './types';

// Долгоживущее состояние сессии (PDR §13.2): статус + текущий пользователь. Токены сюда намеренно
// не входят — они живут только в SecureStore и in-memory кэше session-service (api-сегмент),
// доступ к ним нужен исключительно транспорту (shared/api), а не UI/devtools стора.
export interface ISessionStore {
  status: SessionStatusEnum;
  user: IUser | null;
  setSession: (user: IUser) => void;
  clearSession: () => void;
}

export const useSessionStore = create<ISessionStore>()((set) => ({
  status: SessionStatusEnum.Unknown,
  user: null,
  setSession: (user) => set({ status: SessionStatusEnum.Authenticated, user }),
  clearSession: () => set({ status: SessionStatusEnum.Unauthenticated, user: null }),
}));
