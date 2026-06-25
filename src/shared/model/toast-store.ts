import { create } from 'zustand';

import { logger } from '@/shared/lib/logger';

// Вариант оформления тоста (тинт + иконка). const-object + производный тип вместо TS enum (PDR §6).
export const ToastVariantEnum = {
  Error: 'error',
  Info: 'info',
  Success: 'success',
} as const;
export type ToastVariantEnum = (typeof ToastVariantEnum)[keyof typeof ToastVariantEnum];

// Одно транзиентное сообщение в очереди тостов.
export interface IToast {
  id: number;
  message: string;
  variant: ToastVariantEnum;
}

// Максимум одновременно живущих тостов: при переполнении вытесняется самый старый (FIFO).
const MAX_TOASTS = 3;

// Транзиентные сообщения пользователю (PDR §11). Очередь долгоживущая (как app-store), сами тосты —
// короткоживущие: показ из любого слоя через showToast, авто-/тап-dismiss убирает их по id.
export interface IToastStore {
  toasts: IToast[];
  showToast: (variant: ToastVariantEnum, message: string) => void;
  dismissToast: (id: number) => void;
}

// Монотонный модульный счётчик id: уникален в пределах сессии, детерминирован для тестов и не тянет
// зависимость от shared/lib/id (createId) или Date.now.
let nextToastId = 0;

export const useToastStore = create<IToastStore>()((set) => ({
  toasts: [],

  showToast: (variant, message) => {
    const id = (nextToastId += 1);
    logger.debug(`[toast-store.showToast] +${id} (${variant}): ${message}`);
    set((state) => {
      const next = [...state.toasts, { id, message, variant }];
      // FIFO-кап: держим не больше MAX_TOASTS, вытесняя самые старые.
      return { toasts: next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next };
    });
  },

  dismissToast: (id) => {
    logger.debug(`[toast-store.dismissToast] -${id}`);
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
