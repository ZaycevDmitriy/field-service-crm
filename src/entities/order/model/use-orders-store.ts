import { create } from 'zustand';

import { orderDatabaseService, pullOrders, SyncStateKeyEnum } from '../api';

import { OrderFilterEnum } from './order-filter';
import { ServiceOrderStatusEnum } from './order-status';
import { PhotoSyncStatusEnum } from './photo-sync-status';
import { makeStressOrders, STRESS_TEST, STRESS_TEST_COUNT } from './stress';
import type { IServiceOrder, IServiceOrderPhoto } from './types';

import { createId } from '@/shared/lib/id';
import { logger } from '@/shared/lib/logger';
import { cancelAllReminders, cancelOrderRemindersByKey } from '@/shared/lib/notifications';
import { ToastVariantEnum, useToastStore } from '@/shared/model';

// Стор заявок (PDR §13.1). Держит только базовое состояние; производное (фильтрованный список,
// счётчики, ближайшая заявка) считается чистыми функциями в компонентах, а не здесь.
export interface IOrdersStore {
  orders: IServiceOrder[];
  loading: boolean;
  // Состояние сетевого pull-синка (Phase 12) — отдельно от loading (гидрация из локальной БД):
  // pull-to-refresh крутит спиннер по syncing, не блокируя список локальной гидрацией.
  syncing: boolean;
  error: string | null;
  filter: OrderFilterEnum;
  search: string;
  // Bootstrap при старте приложения: инициализация БД, идемпотентный сид, гидрация стора.
  initialize: () => Promise<void>;
  // Гидрация: грузит заявки из SQLite. Идемпотентна по флагу loading (нужна для pull-to-refresh).
  loadOrders: () => Promise<void>;
  // Курсорный pull заявок с сервера (PDR client-sync §5, T-07): гидрирует стор из БД после
  // применения. Ошибка не стирает локальные данные (офлайн — норма, PDR) — только лог + тост.
  syncOrders: () => Promise<void>;
  // Bootstrap синка при логине/смене пользователя: если userId отличается от последнего
  // sync.lastUserId — локальные данные (заявки, фото, напоминания) очищаются перед pull с нулевого
  // курсора (новый пользователь не должен видеть чужие заявки). Всегда завершается вызовом syncOrders.
  bootstrapSync: (userId: string) => Promise<void>;
  setFilter: (filter: OrderFilterEnum) => void;
  setSearch: (query: string) => void;
  // Переходы статуса: меняют статус только при допустимом исходном (иначе no-op). Персист в БД —
  // fire-and-forget (UI оптимистичен, сигнатуры синхронные); при сбое расхождение до перезагрузки.
  startWork: (orderId: string) => void;
  completeWork: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  // Добавляет фото к заявке. Доменную сборку (id/createdAt) делает стор; вход — абсолютный URI снимка
  // и опциональный комментарий. Оптимистичный апдейт + fire-and-forget персист (как переходы статуса).
  // Доменное правило: фотоотчёт редактируется только у заявки в работе (InProgress), иначе no-op.
  addOrderPhoto: (orderId: string, photo: { uri: string; comment?: string }) => void;
  // Удаляет фото заявки (строку БД и файл — через orderDatabaseService). То же доменное правило:
  // только InProgress. Оптимистичный апдейт + fire-and-forget персист с откатом при сбое.
  removeOrderPhoto: (orderId: string, photoId: string) => void;
  // Очистка локальной БД (Settings): обе таблицы пусты, список → EmptyState. Повторный сид — следующий старт.
  clearDatabase: () => Promise<void>;
}

// Иммутабельно возвращает фото в заявку на исходную позицию — откат оптимистичного
// removeOrderPhoto. Если список успел укоротиться, индекс прижимается к концу. Проверка по id
// страхует от дубля, если фото успели вернуть/добавить заново.
const restorePhoto = (
  orders: IServiceOrder[],
  orderId: string,
  photo: IServiceOrderPhoto,
  index: number,
): IServiceOrder[] =>
  orders.map((order) => {
    if (order.id !== orderId || order.photos.some((existing) => existing.id === photo.id)) {
      return order;
    }
    const photos = [...order.photos];
    photos.splice(Math.min(index, photos.length), 0, photo);

    return { ...order, photos };
  });

// Иммутабельно убирает фото с заданным id из заявки (откат оптимистичного addOrderPhoto).
const removePhoto = (orders: IServiceOrder[], orderId: string, photoId: string): IServiceOrder[] =>
  orders.map((order) =>
    order.id === orderId
      ? { ...order, photos: order.photos.filter((photo) => photo.id !== photoId) }
      : order,
  );

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

// Fire-and-forget персист статуса: не блокирует оптимистичный UI. При отклонении — откат
// оптимистичного перехода (`to` → `from`) через тот же guard-переход. Откат сработает, только если
// статус всё ещё `to`: если пользователь успел сделать следующий переход до этого отклонения, откат
// не применяется — осознанный компромисс (не затираем более новое состояние).
const persistStatus = (
  set: (updater: (state: IOrdersStore) => Partial<IOrdersStore>) => void,
  orderId: string,
  from: ServiceOrderStatusEnum,
  to: ServiceOrderStatusEnum,
  action: string,
  onPersisted?: () => void,
): void => {
  // Dev-only стресс-тест виртуализации: стор наполнен синтетикой мимо БД (см. initialize) — персист
  // пропускается (БД в этом режиме не создана), но onPersisted вызывается: отмена напоминания не
  // зависит от БД, и запланированное на синтетическую заявку уведомление надо снять.
  if (STRESS_TEST) {
    logger.debug(`[useOrdersStore.${action}] STRESS_TEST: персист статуса пропущен.`);
    onPersisted?.();

    return;
  }
  // Промис намеренно не ожидается (оптимистичный UI); rejection обработан здесь же через .catch.
  orderDatabaseService
    .updateOrderStatus(orderId, to)
    // Побочные эффекты закрытия заявки (отмена напоминания) — только после успешного персиста:
    // при откате статуса заявка снова активна, и напоминание должно остаться.
    .then(() => onPersisted?.())
    .catch((error) => {
      logger.error(`[useOrdersStore.${action}] Не удалось персистить статус.`, error);
      useToastStore.getState().showToast(ToastVariantEnum.Error, 'Статус не сохранён');
      set((state) => ({ orders: transitionStatus(state.orders, orderId, to, from) }));
    });
};

export const useOrdersStore = create<IOrdersStore>()((set, get) => ({
  orders: [],
  loading: false,
  syncing: false,
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
      // Клиентский сид демо-данных удалён (Phase 11, PDR client-sync §5/T-05, решение Q-04) —
      // демо-данные сидит сервер (FR-16). БД пуста до первого pull (Phase 12); пустой список —
      // валидное состояние (EmptyState экранов), initDatabase создаёт схему без данных.
      set({ orders: await orderDatabaseService.getOrders(), error: null });
    } catch (error) {
      logger.error('[useOrdersStore.initialize] Не удалось инициализировать БД.', error);
      set({ error: 'Не удалось загрузить заявки' });
    } finally {
      set({ loading: false });
    }
  },

  loadOrders: async () => {
    // Dev-only стресс-тест виртуализации: БД не создана (см. initialize) — pull-to-refresh не должен
    // за ней ходить (иначе «no such table» → error-состояние списка).
    if (STRESS_TEST) {
      logger.debug('[useOrdersStore.loadOrders] STRESS_TEST: загрузка из БД пропущена.');

      return;
    }
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

  syncOrders: async () => {
    // Dev-only стресс-тест виртуализации: БД не создана (см. initialize) — синк не должен за ней
    // ходить (иначе «no such table» → error-состояние списка).
    if (STRESS_TEST) {
      logger.debug('[useOrdersStore.syncOrders] STRESS_TEST: синк пропущен.');

      return;
    }
    // Guard от повторного входа: дубль вызова, пока синк уже идёт (двойной pull-to-refresh,
    // одновременный login-триггер и ручной pull-to-refresh) — no-op.
    if (get().syncing) {
      return;
    }
    // Guard от гонки с bootstrapSync (флаг loading): pull-to-refresh во время wipe при смене
    // пользователя прочитал бы ещё не стёртый курсор предыдущего пользователя и спуллил бы с него
    // под новым токеном — курсор ушёл бы «вперёд данных», и старые заявки молча потерялись бы
    // (финальный syncOrders внутри bootstrapSync не самокорректирует: он no-op по guard'у syncing).
    if (get().loading) {
      logger.debug('[useOrdersStore.syncOrders] Идёт bootstrap/гидрация — синк пропущен.');

      return;
    }
    set({ syncing: true });
    try {
      await pullOrders();
      set({ orders: await orderDatabaseService.getOrders(), error: null });
    } catch (error) {
      // Ошибка синка НЕ стирает локальные данные (офлайн — норма, PDR): orders/error не трогаем,
      // список остаётся как есть — только лог (один слой логирования) и тост.
      // Открытый вопрос → Phase 15 (Sync UX): тост показывается и на авто-триггере при логине —
      // каждый офлайн-вход встречает error-тостом, хотя офлайн — норма. Решить там: авто-путь
      // сделать тихим (только лог) либо оставить единый UX; сейчас syncOrders общий для
      // pull-to-refresh и логина.
      logger.error('[useOrdersStore.syncOrders] Не удалось синхронизировать заявки.', error);
      useToastStore.getState().showToast(ToastVariantEnum.Error, 'Не удалось обновить заявки');
    } finally {
      set({ syncing: false });
    }
  },

  bootstrapSync: async (userId) => {
    // Dev-only стресс-тест виртуализации: БД не создана (см. initialize) — bootstrap не должен за
    // ней ходить.
    if (STRESS_TEST) {
      logger.debug('[useOrdersStore.bootstrapSync] STRESS_TEST: bootstrap пропущен.');

      return;
    }
    // Guard от повторного входа (StrictMode-дубль в dev, тот же паттерн, что в initialize): без
    // него параллельный вызов мог бы увидеть ещё не обновлённый sync.lastUserId и wipe'нуть дважды.
    if (get().loading) {
      return;
    }
    set({ loading: true });
    try {
      const lastUserId = await orderDatabaseService.getSyncStateValue(SyncStateKeyEnum.LastUserId);
      if (lastUserId !== userId) {
        logger.info(
          '[useOrdersStore.bootstrapSync] Смена пользователя — локальные заявки, фото и напоминания будут очищены.',
        );
        // orderDatabaseService напрямую (не get().clearDatabase()): у обоих общий флаг loading,
        // уже занятый этим вызовом — store-метод молча пропустил бы очистку по своему же guard'у.
        await orderDatabaseService.clearDatabase();
        // Та же пара, что у кнопки «Очистить БД» в Settings — новый пользователь не должен получать
        // уведомления по заявкам предыдущего.
        await cancelAllReminders();
        await orderDatabaseService.setSyncStateValue(SyncStateKeyEnum.LastUserId, userId);
        set({ orders: await orderDatabaseService.getOrders(), error: null });
      }
    } catch (error) {
      logger.error(
        '[useOrdersStore.bootstrapSync] Не удалось подготовить локальные данные.',
        error,
      );
    } finally {
      set({ loading: false });
    }

    await get().syncOrders();
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
    persistStatus(
      set,
      orderId,
      ServiceOrderStatusEnum.New,
      ServiceOrderStatusEnum.InProgress,
      'startWork',
    );
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
    persistStatus(
      set,
      orderId,
      ServiceOrderStatusEnum.InProgress,
      ServiceOrderStatusEnum.Done,
      'completeWork',
      // Заявка закрыта — напоминание больше не нужно (cancelOrderRemindersByKey не бросает).
      () => void cancelOrderRemindersByKey(orderId),
    );
  },

  // Отмена допустима только для активной заявки (New/InProgress); Done/Cancelled — no-op.
  cancelOrder: (orderId) => {
    const order = get().orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }
    const isActive =
      order.status === ServiceOrderStatusEnum.New ||
      order.status === ServiceOrderStatusEnum.InProgress;
    if (!isActive) {
      return;
    }
    const previousStatus = order.status;
    set({
      orders: transitionStatus(
        get().orders,
        orderId,
        previousStatus,
        ServiceOrderStatusEnum.Cancelled,
      ),
    });
    persistStatus(
      set,
      orderId,
      previousStatus,
      ServiceOrderStatusEnum.Cancelled,
      'cancelOrder',
      // Заявка отменена — напоминание больше не нужно (cancelOrderRemindersByKey не бросает).
      () => void cancelOrderRemindersByKey(orderId),
    );
  },

  addOrderPhoto: (orderId, { uri, comment }) => {
    const order = get().orders.find((item) => item.id === orderId);
    // Guard доменного правила: фото добавляются только к заявке в работе (страхует и от гонки —
    // статус мог смениться, пока пользователь был на экране камеры).
    if (!order || order.status !== ServiceOrderStatusEnum.InProgress) {
      return;
    }
    // Комментарий кладём только если он непустой (домен: отсутствие ключа вместо пустой строки).
    const trimmedComment = comment?.trim();
    const photo: IServiceOrderPhoto = {
      id: createId(),
      uri,
      ...(trimmedComment ? { comment: trimmedComment } : {}),
      createdAt: new Date().toISOString(),
      syncStatus: PhotoSyncStatusEnum.Local,
    };
    set({
      orders: get().orders.map((item) =>
        item.id === orderId ? { ...item, photos: [...item.photos, photo] } : item,
      ),
    });
    // Dev-only стресс-тест виртуализации: БД не создана (см. initialize) — персист фото пропускается.
    if (STRESS_TEST) {
      logger.debug('[useOrdersStore.addOrderPhoto] STRESS_TEST: персист фото пропущен.');

      return;
    }
    // Промис намеренно не ожидается (оптимистичный UI); rejection обработан здесь же через .catch.
    orderDatabaseService.addOrderPhoto(orderId, photo).catch((error) => {
      logger.error('[useOrdersStore.addOrderPhoto] Не удалось персистить фото.', error);
      useToastStore.getState().showToast(ToastVariantEnum.Error, 'Фото не сохранено');
      // Откат оптимистичного добавления: убираем именно это фото по id (другие фото заявки,
      // добавленные за это время, не затрагиваются).
      set((state) => ({ orders: removePhoto(state.orders, orderId, photo.id) }));
    });
  },

  removeOrderPhoto: (orderId, photoId) => {
    const order = get().orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }
    // Guard доменного правила: фотоотчёт редактируется только у заявки в работе (см. addOrderPhoto).
    // Пользователь уже подтвердил удаление в Alert — молчаливый no-op выглядел бы как поломка,
    // поэтому отказ сообщается Info-тостом (в отличие от addOrderPhoto, где подтверждения нет).
    if (order.status !== ServiceOrderStatusEnum.InProgress) {
      useToastStore
        .getState()
        .showToast(ToastVariantEnum.Info, 'Заявка не в работе — фото не удалено');

      return;
    }
    // Индекс запоминается до удаления: откат вернёт фото на исходную позицию в сетке.
    const photoIndex = order.photos.findIndex((item) => item.id === photoId);
    if (photoIndex === -1) {
      return;
    }
    const photo = order.photos[photoIndex];
    set({ orders: removePhoto(get().orders, orderId, photoId) });
    // Dev-only стресс-тест виртуализации: БД не создана (см. initialize) — персист удаления пропускается.
    if (STRESS_TEST) {
      logger.debug('[useOrdersStore.removeOrderPhoto] STRESS_TEST: персист удаления пропущен.');

      return;
    }
    // Промис намеренно не ожидается (оптимистичный UI); rejection обработан здесь же через .catch.
    orderDatabaseService.deleteOrderPhoto(photoId).catch((error) => {
      logger.error('[useOrdersStore.removeOrderPhoto] Не удалось удалить фото.', error);
      useToastStore.getState().showToast(ToastVariantEnum.Error, 'Фото не удалено');
      // Откат оптимистичного удаления: возвращаем фото на исходную позицию (см. restorePhoto).
      set((state) => ({ orders: restorePhoto(state.orders, orderId, photo, photoIndex) }));
    });
  },

  clearDatabase: async () => {
    // Dev-only стресс-тест виртуализации: БД не создана (см. initialize) — очищать нечего, но
    // молчаливый no-op маскировал бы нажатие кнопки в Settings, поэтому явный Info-тост.
    if (STRESS_TEST) {
      logger.debug('[useOrdersStore.clearDatabase] STRESS_TEST: очистка БД пропущена.');
      useToastStore.getState().showToast(ToastVariantEnum.Info, 'Недоступно в режиме стресс-теста');

      return;
    }
    // Тот же guard/loading-паттерн, что в initialize/loadOrders: не даёт clearDatabase запуститься
    // параллельно с гидрацией стора (и наоборот) — иначе порядок резолва промисов не гарантирован.
    // Отказ теперь виден пользователю тостом (раньше был молчаливым no-op).
    if (get().loading) {
      logger.warn('[useOrdersStore.clearDatabase] Пропущено: идёт загрузка данных.');
      useToastStore
        .getState()
        .showToast(ToastVariantEnum.Info, 'Данные загружаются — попробуйте ещё раз');

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
      // store.error рендерится только в OrdersListEmpty (список пуст) — при сбое очистки список
      // остаётся непустым, поэтому ошибка дополнительно сообщается тостом.
      useToastStore.getState().showToast(ToastVariantEnum.Error, 'Не удалось очистить базу данных');
    } finally {
      set({ loading: false });
    }
  },
}));
