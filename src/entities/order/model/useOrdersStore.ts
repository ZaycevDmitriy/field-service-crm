import { create } from 'zustand';

import { orderDatabaseService } from '../api';

import { OrderFilterEnum } from './order-filter';
import { ServiceOrderStatusEnum } from './order-status';
import { makeStressOrders, STRESS_TEST, STRESS_TEST_COUNT } from './stress';
import type { IServiceOrder, IServiceOrderPhoto } from './types';

import { createId } from '@/shared/lib/id';
import { logger } from '@/shared/lib/logger';
import { ToastVariantEnum, useToastStore } from '@/shared/model';

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
  // Добавляет фото к заявке. Доменную сборку (id/createdAt) делает стор; вход — абсолютный URI снимка
  // и опциональный комментарий. Оптимистичный апдейт + fire-and-forget персист (как переходы статуса).
  addOrderPhoto: (orderId: string, photo: { uri: string; comment?: string }) => void;
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
    logger.error(`[useOrdersStore.${action}] Не удалось персистить статус.`, error);
    useToastStore.getState().showToast(ToastVariantEnum.Error, 'Статус не сохранён');
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
    // Dev-only стресс-тест виртуализации: наполняем стор синтетикой мимо БД (см. model/stress.ts).
    if (STRESS_TEST) {
      logger.warn(
        `[useOrdersStore.initialize] STRESS_TEST: ${STRESS_TEST_COUNT} синтетических заявок.`,
      );
      set({ orders: makeStressOrders(STRESS_TEST_COUNT), loading: false, error: null });
      return;
    }
    set({ loading: true });
    try {
      await orderDatabaseService.initDatabase();
      await orderDatabaseService.seedDatabaseIfNeeded();
      set({ orders: await orderDatabaseService.getOrders(), error: null });
    } catch (error) {
      logger.error('[useOrdersStore.initialize] Не удалось инициализировать БД.', error);
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
      logger.error('[useOrdersStore.loadOrders] Не удалось загрузить заявки.', error);
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

  addOrderPhoto: (orderId, { uri, comment }) => {
    const order = get().orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }
    // Комментарий кладём только если он непустой (домен: отсутствие ключа вместо пустой строки).
    const trimmedComment = comment?.trim();
    const photo: IServiceOrderPhoto = {
      id: createId(),
      uri,
      ...(trimmedComment ? { comment: trimmedComment } : {}),
      createdAt: new Date().toISOString(),
    };
    set({
      orders: get().orders.map((item) =>
        item.id === orderId ? { ...item, photos: [...item.photos, photo] } : item,
      ),
    });
    // Промис намеренно не ожидается (оптимистичный UI); rejection обработан здесь же через .catch.
    orderDatabaseService.addOrderPhoto(orderId, photo).catch((error) => {
      logger.error('[useOrdersStore.addOrderPhoto] Не удалось персистить фото.', error);
      useToastStore.getState().showToast(ToastVariantEnum.Error, 'Фото не сохранено');
    });
  },

  clearDatabase: async () => {
    // Тот же guard/loading-паттерн, что в initialize/loadOrders: не даёт clearDatabase запуститься
    // параллельно с гидрацией стора (и наоборот) — иначе порядок резолва промисов не гарантирован.
    if (get().loading) {
      return;
    }
    set({ loading: true });
    try {
      await orderDatabaseService.clearDatabase();
      // Перезагрузка из БД: после очистки список пуст → EmptyState на экранах.
      set({ orders: await orderDatabaseService.getOrders(), error: null });
    } catch (error) {
      logger.error('[useOrdersStore.clearDatabase] Не удалось очистить БД.', error);
      set({ error: 'Не удалось очистить базу данных' });
    } finally {
      set({ loading: false });
    }
  },
}));
