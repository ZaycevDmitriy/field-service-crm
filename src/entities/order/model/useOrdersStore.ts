import { create } from 'zustand';

import { orderMockService } from '../api';

import { OrderFilterEnum } from './order-filter';
import { ServiceOrderStatusEnum } from './order-status';
import type { IServiceOrder } from './types';

// Стор заявок (PDR §13.1). Держит только базовое состояние; производное (фильтрованный список,
// счётчики, ближайшая заявка) считается чистыми функциями в компонентах, а не здесь.
export interface IOrdersStore {
  orders: IServiceOrder[];
  loading: boolean;
  error: string | null;
  filter: OrderFilterEnum;
  search: string;
  // Гидрация: грузит заявки из mock-сервиса (в Phase 4 — из SQLite). Идемпотентна по флагу loading.
  loadOrders: () => Promise<void>;
  setFilter: (filter: OrderFilterEnum) => void;
  setSearch: (query: string) => void;
  // Переходы статуса: меняют статус только при допустимом исходном (иначе no-op).
  startWork: (orderId: string) => void;
  completeWork: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
}

// Иммутабельно меняет статус заявки с заданным id при совпадении исходного статуса (guard).
const transitionStatus = (
  orders: IServiceOrder[],
  orderId: string,
  from: ServiceOrderStatusEnum,
  to: ServiceOrderStatusEnum,
): IServiceOrder[] =>
  orders.map((order) =>
    order.id === orderId && order.status === from ? { ...order, status: to } : order,
  );

export const useOrdersStore = create<IOrdersStore>()((set, get) => ({
  orders: [],
  loading: false,
  error: null,
  filter: OrderFilterEnum.All,
  search: '',

  loadOrders: async () => {
    // Guard от повторного входа: дубль вызова во время загрузки (в т.ч. StrictMode в dev) — no-op.
    // Первый set({ loading: true }) проходит синхронно до await, поэтому второй вызов отсекается здесь.
    if (get().loading) {
      return;
    }
    set({ loading: true });
    try {
      const orders = await orderMockService.getOrders();
      set({ orders, error: null });
    } catch (error) {
      console.error('[useOrdersStore.loadOrders] Не удалось загрузить заявки.', error);
      set({ error: 'Не удалось загрузить заявки' });
    } finally {
      set({ loading: false });
    }
  },

  setFilter: (filter) => set({ filter }),
  setSearch: (query) => set({ search: query }),

  startWork: (orderId) =>
    set({
      orders: transitionStatus(
        get().orders,
        orderId,
        ServiceOrderStatusEnum.New,
        ServiceOrderStatusEnum.InProgress,
      ),
    }),

  completeWork: (orderId) =>
    set({
      orders: transitionStatus(
        get().orders,
        orderId,
        ServiceOrderStatusEnum.InProgress,
        ServiceOrderStatusEnum.Done,
      ),
    }),

  // Отмена допустима только для активной заявки (New/InProgress); Done/Cancelled — no-op.
  cancelOrder: (orderId) =>
    set({
      orders: get().orders.map((order) => {
        const isActive =
          order.status === ServiceOrderStatusEnum.New ||
          order.status === ServiceOrderStatusEnum.InProgress;

        return order.id === orderId && isActive
          ? { ...order, status: ServiceOrderStatusEnum.Cancelled }
          : order;
      }),
    }),
}));
