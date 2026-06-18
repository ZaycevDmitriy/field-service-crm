import { create } from 'zustand';

import { orderDatabaseService } from '../api';

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
  // Bootstrap при старте приложения: инициализация БД, идемпотентный сид, гидрация стора.
  initialize: () => Promise<void>;
  // Гидрация: грузит заявки из SQLite. Идемпотентна по флагу loading (нужна для pull-to-refresh).
  loadOrders: () => Promise<void>;
  setFilter: (filter: OrderFilterEnum) => void;
  setSearch: (query: string) => void;
  // Переходы статуса: меняют статус только при допустимом исходном (иначе no-op). Персист в БД —
  // fire-and-forget (UI оптимистичен, сигнатуры синхронные); при сбое расхождение до перезагрузки.
  startWork: (orderId: string) => void;
  completeWork: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  // Очистка локальной БД (Settings): обе таблицы пусты, список → EmptyState. Повторный сид — следующий старт.
  clearDatabase: () => Promise<void>;
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

// Fire-and-forget персист статуса: не блокирует оптимистичный UI, ошибку только логирует.
const persistStatus = (orderId: string, status: ServiceOrderStatusEnum, action: string): void => {
  // Промис намеренно не ожидается (оптимистичный UI); rejection обработан здесь же через .catch.
  orderDatabaseService.updateOrderStatus(orderId, status).catch((error) => {
    console.error(`[useOrdersStore.${action}] Не удалось персистить статус.`, error);
  });
};

export const useOrdersStore = create<IOrdersStore>()((set, get) => ({
  orders: [],
  loading: false,
  error: null,
  filter: OrderFilterEnum.All,
  search: '',

  initialize: async () => {
    // Guard от повторного входа (StrictMode-дубль в dev). Не зовём loadOrders, чтобы не упереться
    // в его собственный guard — гидрируем напрямую под общим окном loading.
    if (get().loading) {
      return;
    }
    set({ loading: true });
    try {
      await orderDatabaseService.initDatabase();
      await orderDatabaseService.seedDatabaseIfNeeded();
      set({ orders: await orderDatabaseService.getOrders(), error: null });
    } catch (error) {
      console.error('[useOrdersStore.initialize] Не удалось инициализировать БД.', error);
      set({ error: 'Не удалось загрузить заявки' });
    } finally {
      set({ loading: false });
    }
  },

  loadOrders: async () => {
    // Guard от повторного входа: дубль вызова во время загрузки (в т.ч. StrictMode в dev) — no-op.
    // Первый set({ loading: true }) проходит синхронно до await, поэтому второй вызов отсекается здесь.
    if (get().loading) {
      return;
    }
    set({ loading: true });
    try {
      const orders = await orderDatabaseService.getOrders();
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

  startWork: (orderId) => {
    const order = get().orders.find((item) => item.id === orderId);
    if (!order || order.status !== ServiceOrderStatusEnum.New) {
      return;
    }
    set({
      orders: transitionStatus(
        get().orders,
        orderId,
        ServiceOrderStatusEnum.New,
        ServiceOrderStatusEnum.InProgress,
      ),
    });
    persistStatus(orderId, ServiceOrderStatusEnum.InProgress, 'startWork');
  },

  completeWork: (orderId) => {
    const order = get().orders.find((item) => item.id === orderId);
    if (!order || order.status !== ServiceOrderStatusEnum.InProgress) {
      return;
    }
    set({
      orders: transitionStatus(
        get().orders,
        orderId,
        ServiceOrderStatusEnum.InProgress,
        ServiceOrderStatusEnum.Done,
      ),
    });
    persistStatus(orderId, ServiceOrderStatusEnum.Done, 'completeWork');
  },

  // Отмена допустима только для активной заявки (New/InProgress); Done/Cancelled — no-op.
  cancelOrder: (orderId) => {
    const order = get().orders.find((item) => item.id === orderId);
    const isActive =
      order?.status === ServiceOrderStatusEnum.New ||
      order?.status === ServiceOrderStatusEnum.InProgress;
    if (!isActive) {
      return;
    }
    set({
      orders: get().orders.map((item) =>
        item.id === orderId ? { ...item, status: ServiceOrderStatusEnum.Cancelled } : item,
      ),
    });
    persistStatus(orderId, ServiceOrderStatusEnum.Cancelled, 'cancelOrder');
  },

  clearDatabase: async () => {
    try {
      await orderDatabaseService.clearDatabase();
      // Перезагрузка из БД: после очистки список пуст → EmptyState на экранах.
      set({ orders: await orderDatabaseService.getOrders(), error: null });
    } catch (error) {
      console.error('[useOrdersStore.clearDatabase] Не удалось очистить БД.', error);
      set({ error: 'Не удалось очистить базу данных' });
    }
  },
}));
