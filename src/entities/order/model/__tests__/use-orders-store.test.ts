import { orderDatabaseService, pullOrders, SyncStateKeyEnum } from '../../api';
import { ServiceOrderStatusEnum } from '../order-status';
import { PhotoSyncStatusEnum } from '../photo-sync-status';
import type { IServiceOrder } from '../types';
import { useOrdersStore } from '../use-orders-store';

import { cancelAllReminders, cancelOrderRemindersByKey } from '@/shared/lib/notifications';
import { ToastVariantEnum, useToastStore } from '@/shared/model';

// Изолируем стор от SQLite: orderDatabaseService — единственная сторонняя зависимость guard-ов
// и переходов статуса, которые тестируются здесь.
jest.mock('../../api', () => ({
  orderDatabaseService: {
    initDatabase: jest.fn(),
    getOrders: jest.fn(),
    updateOrderStatus: jest.fn(),
    addOrderPhoto: jest.fn(),
    deleteOrderPhoto: jest.fn(),
    clearDatabase: jest.fn(),
    getSyncStateValue: jest.fn(),
    setSyncStateValue: jest.fn(),
  },
  pullOrders: jest.fn(),
  SyncStateKeyEnum: { Cursor: 'sync.cursor', LastUserId: 'sync.lastUserId' },
}));

// Изолируем стор от expo-notifications: cancelOrderRemindersByKey (M6) — единственная зависимость
// сегмента notifications, которая нужна переходам статуса; cancelAllReminders — bootstrapSync (Phase 12).
jest.mock('@/shared/lib/notifications', () => ({
  cancelOrderRemindersByKey: jest.fn(),
  cancelAllReminders: jest.fn(),
}));

const mockedService = orderDatabaseService as jest.Mocked<typeof orderDatabaseService>;
const mockedCancelReminders = cancelOrderRemindersByKey as jest.Mock;
const mockedCancelAllReminders = cancelAllReminders as jest.Mock;
const mockedPullOrders = pullOrders as jest.Mock;

// URI снимка для тестов фотоотчёта (общий для addOrderPhoto/removeOrderPhoto/STRESS_TEST).
const PHOTO_URI = 'file://photo.jpg';

// Фабрика фикстур (совпадает с конвенцией getNearestOrder.test.ts): дефолт — активная заявка.
const makeOrder = (overrides: Partial<IServiceOrder> = {}): IServiceOrder => ({
  id: 'order-1',
  status: ServiceOrderStatusEnum.New,
  title: 'Заявка',
  client: 'Клиент',
  address: 'Адрес',
  description: '',
  scheduledTime: '09:00',
  scheduledSlot: '09:00 — 10:00',
  latitude: 55.75,
  longitude: 37.61,
  photos: [],
  ...overrides,
});

// Сброс стора между тестами: модульный синглтон (см. toast-store.test.ts).
const resetStore = (orders: IServiceOrder[] = []) =>
  useOrdersStore.setState({ orders, loading: false, syncing: false, error: null });

describe('useOrdersStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.updateOrderStatus.mockResolvedValue(undefined);
    mockedService.addOrderPhoto.mockResolvedValue(undefined);
    mockedService.deleteOrderPhoto.mockResolvedValue(undefined);
    mockedService.getSyncStateValue.mockResolvedValue(null);
    mockedPullOrders.mockResolvedValue(undefined);
    resetStore();
    useToastStore.setState({ toasts: [] });
  });

  describe('startWork', () => {
    it('переводит New → InProgress и персистит статус', () => {
      resetStore([makeOrder({ status: ServiceOrderStatusEnum.New })]);

      useOrdersStore.getState().startWork('order-1');

      expect(useOrdersStore.getState().orders[0].status).toBe(ServiceOrderStatusEnum.InProgress);
      expect(mockedService.updateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        ServiceOrderStatusEnum.InProgress,
      );
    });

    it('no-op, если заявка не найдена', () => {
      resetStore([]);

      useOrdersStore.getState().startWork('missing');

      expect(useOrdersStore.getState().orders).toHaveLength(0);
      expect(mockedService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('откатывает статус к исходному при отклонении персиста и показывает тост (M1)', async () => {
      resetStore([makeOrder({ status: ServiceOrderStatusEnum.New })]);
      mockedService.updateOrderStatus.mockRejectedValueOnce(new Error('db fail'));

      useOrdersStore.getState().startWork('order-1');
      expect(useOrdersStore.getState().orders[0].status).toBe(ServiceOrderStatusEnum.InProgress);

      await Promise.resolve().then().then().then();

      expect(useOrdersStore.getState().orders[0].status).toBe(ServiceOrderStatusEnum.New);
      expect(useToastStore.getState().toasts).toMatchObject([{ variant: ToastVariantEnum.Error }]);
    });

    it('не откатывает статус, если до отклонения уже произошёл следующий переход (гонка)', async () => {
      resetStore([makeOrder({ status: ServiceOrderStatusEnum.New })]);
      mockedService.updateOrderStatus.mockRejectedValueOnce(new Error('db fail'));

      useOrdersStore.getState().startWork('order-1');
      // Пользователь успел перевести заявку дальше до того, как reject startWork долетел.
      useOrdersStore.getState().completeWork('order-1');

      await Promise.resolve().then().then().then();

      expect(useOrdersStore.getState().orders[0].status).toBe(ServiceOrderStatusEnum.Done);
    });

    it.each([
      ServiceOrderStatusEnum.InProgress,
      ServiceOrderStatusEnum.Done,
      ServiceOrderStatusEnum.Cancelled,
    ])('no-op, если исходный статус %s (не New)', (status) => {
      resetStore([makeOrder({ status })]);

      useOrdersStore.getState().startWork('order-1');

      expect(useOrdersStore.getState().orders[0].status).toBe(status);
      expect(mockedService.updateOrderStatus).not.toHaveBeenCalled();
    });
  });

  describe('completeWork', () => {
    it('переводит InProgress → Done', () => {
      resetStore([makeOrder({ status: ServiceOrderStatusEnum.InProgress })]);

      useOrdersStore.getState().completeWork('order-1');

      expect(useOrdersStore.getState().orders[0].status).toBe(ServiceOrderStatusEnum.Done);
      expect(mockedService.updateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        ServiceOrderStatusEnum.Done,
      );
    });

    it.each([
      ServiceOrderStatusEnum.New,
      ServiceOrderStatusEnum.Done,
      ServiceOrderStatusEnum.Cancelled,
    ])('no-op, если исходный статус %s (не InProgress)', (status) => {
      resetStore([makeOrder({ status })]);

      useOrdersStore.getState().completeWork('order-1');

      expect(useOrdersStore.getState().orders[0].status).toBe(status);
      expect(mockedService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('отменяет напоминание по заявке после успешного персиста перехода (M6)', async () => {
      resetStore([makeOrder({ status: ServiceOrderStatusEnum.InProgress })]);

      useOrdersStore.getState().completeWork('order-1');

      await Promise.resolve().then().then().then();

      expect(mockedCancelReminders).toHaveBeenCalledWith('order-1');
    });

    it('не отменяет напоминание при отклонении персиста — статус откатывается, заявка снова активна', async () => {
      resetStore([makeOrder({ status: ServiceOrderStatusEnum.InProgress })]);
      mockedService.updateOrderStatus.mockRejectedValueOnce(new Error('db fail'));

      useOrdersStore.getState().completeWork('order-1');

      await Promise.resolve().then().then().then();

      expect(mockedCancelReminders).not.toHaveBeenCalled();
    });

    it('не отменяет напоминание, если переход отклонён guard-ом (M6)', () => {
      resetStore([makeOrder({ status: ServiceOrderStatusEnum.New })]);

      useOrdersStore.getState().completeWork('order-1');

      expect(mockedCancelReminders).not.toHaveBeenCalled();
    });
  });

  describe('cancelOrder', () => {
    it.each([ServiceOrderStatusEnum.New, ServiceOrderStatusEnum.InProgress])(
      'отменяет активную заявку (%s → Cancelled)',
      (status) => {
        resetStore([makeOrder({ status })]);

        useOrdersStore.getState().cancelOrder('order-1');

        expect(useOrdersStore.getState().orders[0].status).toBe(ServiceOrderStatusEnum.Cancelled);
      },
    );

    it.each([ServiceOrderStatusEnum.Done, ServiceOrderStatusEnum.Cancelled])(
      'no-op для уже завершённой/отменённой заявки (%s)',
      (status) => {
        resetStore([makeOrder({ status })]);

        useOrdersStore.getState().cancelOrder('order-1');

        expect(useOrdersStore.getState().orders[0].status).toBe(status);
        expect(mockedService.updateOrderStatus).not.toHaveBeenCalled();
      },
    );

    it('отменяет напоминание по заявке после успешного персиста отмены (M6)', async () => {
      resetStore([makeOrder({ status: ServiceOrderStatusEnum.New })]);

      useOrdersStore.getState().cancelOrder('order-1');

      await Promise.resolve().then().then().then();

      expect(mockedCancelReminders).toHaveBeenCalledWith('order-1');
    });

    it('не отменяет напоминание, если отмена — no-op (заявка уже закрыта) (M6)', () => {
      resetStore([makeOrder({ status: ServiceOrderStatusEnum.Done })]);

      useOrdersStore.getState().cancelOrder('order-1');

      expect(mockedCancelReminders).not.toHaveBeenCalled();
    });
  });

  describe('addOrderPhoto', () => {
    // Фото редактируются только у заявки в работе — фикстуры по умолчанию InProgress.
    const makeInProgressOrder = () => makeOrder({ status: ServiceOrderStatusEnum.InProgress });

    it('добавляет фото и обрезает комментарий', () => {
      resetStore([makeInProgressOrder()]);

      useOrdersStore.getState().addOrderPhoto('order-1', {
        uri: PHOTO_URI,
        comment: '  Готово  ',
      });

      const [photo] = useOrdersStore.getState().orders[0].photos;
      expect(photo.uri).toBe(PHOTO_URI);
      expect(photo.comment).toBe('Готово');
      expect(mockedService.addOrderPhoto).toHaveBeenCalledWith('order-1', photo);
    });

    it.each(['', '   '])(
      'пустой/пробельный комментарий (%j) не создаёт ключ comment',
      (comment) => {
        resetStore([makeInProgressOrder()]);

        useOrdersStore.getState().addOrderPhoto('order-1', { uri: PHOTO_URI, comment });

        const [photo] = useOrdersStore.getState().orders[0].photos;
        expect(photo).not.toHaveProperty('comment');
      },
    );

    it('no-op, если заявка не найдена', () => {
      resetStore([]);

      useOrdersStore.getState().addOrderPhoto('missing', { uri: PHOTO_URI });

      expect(mockedService.addOrderPhoto).not.toHaveBeenCalled();
    });

    it.each([
      ServiceOrderStatusEnum.New,
      ServiceOrderStatusEnum.Done,
      ServiceOrderStatusEnum.Cancelled,
    ])('no-op, если статус заявки %s (не InProgress)', (status) => {
      resetStore([makeOrder({ status })]);

      useOrdersStore.getState().addOrderPhoto('order-1', { uri: PHOTO_URI });

      expect(useOrdersStore.getState().orders[0].photos).toHaveLength(0);
      expect(mockedService.addOrderPhoto).not.toHaveBeenCalled();
    });

    it('убирает фото из стора при отклонении персиста (M1)', async () => {
      resetStore([makeInProgressOrder()]);
      mockedService.addOrderPhoto.mockRejectedValueOnce(new Error('db fail'));

      useOrdersStore.getState().addOrderPhoto('order-1', { uri: PHOTO_URI });
      expect(useOrdersStore.getState().orders[0].photos).toHaveLength(1);

      await Promise.resolve().then().then().then();

      expect(useOrdersStore.getState().orders[0].photos).toHaveLength(0);
      expect(useToastStore.getState().toasts).toMatchObject([{ variant: ToastVariantEnum.Error }]);
    });
  });

  describe('removeOrderPhoto', () => {
    const PHOTO = {
      id: 'photo-1',
      uri: PHOTO_URI,
      comment: 'Готово',
      createdAt: '2026-07-05T10:00:00.000Z',
      syncStatus: PhotoSyncStatusEnum.Local,
    };
    const makeOrderWithPhoto = (
      status: ServiceOrderStatusEnum = ServiceOrderStatusEnum.InProgress,
    ) => makeOrder({ status, photos: [PHOTO] });

    it('удаляет фото из стора и персистит удаление', () => {
      resetStore([makeOrderWithPhoto()]);

      useOrdersStore.getState().removeOrderPhoto('order-1', 'photo-1');

      expect(useOrdersStore.getState().orders[0].photos).toHaveLength(0);
      expect(mockedService.deleteOrderPhoto).toHaveBeenCalledWith('photo-1');
    });

    it.each([
      ServiceOrderStatusEnum.New,
      ServiceOrderStatusEnum.Done,
      ServiceOrderStatusEnum.Cancelled,
    ])('отказ с Info-тостом, если статус заявки %s (не InProgress)', (status) => {
      resetStore([makeOrderWithPhoto(status)]);

      useOrdersStore.getState().removeOrderPhoto('order-1', 'photo-1');

      expect(useOrdersStore.getState().orders[0].photos).toHaveLength(1);
      expect(mockedService.deleteOrderPhoto).not.toHaveBeenCalled();
      // Пользователь подтвердил удаление в Alert — отказ guard'а не должен быть молчаливым.
      expect(useToastStore.getState().toasts).toMatchObject([{ variant: ToastVariantEnum.Info }]);
    });

    it('no-op, если фото не найдено', () => {
      resetStore([makeOrder({ status: ServiceOrderStatusEnum.InProgress })]);

      useOrdersStore.getState().removeOrderPhoto('order-1', 'missing');

      expect(mockedService.deleteOrderPhoto).not.toHaveBeenCalled();
    });

    it('возвращает фото в заявку при отклонении персиста и показывает тост', async () => {
      resetStore([makeOrderWithPhoto()]);
      mockedService.deleteOrderPhoto.mockRejectedValueOnce(new Error('db fail'));

      useOrdersStore.getState().removeOrderPhoto('order-1', 'photo-1');
      expect(useOrdersStore.getState().orders[0].photos).toHaveLength(0);

      await Promise.resolve().then().then().then();

      expect(useOrdersStore.getState().orders[0].photos).toMatchObject([{ id: 'photo-1' }]);
      expect(useToastStore.getState().toasts).toMatchObject([{ variant: ToastVariantEnum.Error }]);
    });

    it('откат возвращает фото на исходную позицию в списке', async () => {
      const first = { ...PHOTO, id: 'photo-first' };
      const last = { ...PHOTO, id: 'photo-last' };
      resetStore([
        makeOrder({ status: ServiceOrderStatusEnum.InProgress, photos: [first, PHOTO, last] }),
      ]);
      mockedService.deleteOrderPhoto.mockRejectedValueOnce(new Error('db fail'));

      useOrdersStore.getState().removeOrderPhoto('order-1', 'photo-1');
      expect(useOrdersStore.getState().orders[0].photos).toMatchObject([
        { id: first.id },
        { id: last.id },
      ]);

      await Promise.resolve().then().then().then();

      expect(useOrdersStore.getState().orders[0].photos).toMatchObject([
        { id: first.id },
        { id: PHOTO.id },
        { id: last.id },
      ]);
    });
  });

  describe('clearDatabase', () => {
    it('выставляет loading=true на время выполнения и сбрасывает его в finally', async () => {
      let resolveClear: () => void = () => undefined;
      mockedService.clearDatabase.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveClear = resolve;
          }),
      );
      mockedService.getOrders.mockResolvedValue([]);

      const pending = useOrdersStore.getState().clearDatabase();
      expect(useOrdersStore.getState().loading).toBe(true);

      resolveClear();
      await pending;

      expect(useOrdersStore.getState().loading).toBe(false);
      expect(useOrdersStore.getState().orders).toEqual([]);
    });

    it('не запускается повторно, пока выполняется loadOrders/предыдущий вызов (фикс гонки)', async () => {
      let resolveClear: () => void = () => undefined;
      mockedService.clearDatabase.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveClear = resolve;
          }),
      );
      mockedService.getOrders.mockResolvedValue([]);

      const first = useOrdersStore.getState().clearDatabase();
      // Конкурентный loadOrders во время очистки — должен no-op по общему loading-флагу.
      await useOrdersStore.getState().loadOrders();
      expect(mockedService.getOrders).not.toHaveBeenCalled();

      resolveClear();
      await first;

      expect(mockedService.clearDatabase).toHaveBeenCalledTimes(1);
    });

    it('guard: вызов при loading=true не зовёт сервис и показывает тост вместо молчаливого no-op', async () => {
      useOrdersStore.setState({ loading: true });
      useToastStore.setState({ toasts: [] });

      await useOrdersStore.getState().clearDatabase();

      expect(mockedService.clearDatabase).not.toHaveBeenCalled();
      expect(useToastStore.getState().toasts).toMatchObject([{ variant: ToastVariantEnum.Info }]);
    });
  });

  describe('syncOrders', () => {
    it('успешный pull: гидрирует orders из БД, syncing переключается true → false', async () => {
      let resolvePull: () => void = () => undefined;
      mockedPullOrders.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolvePull = resolve;
          }),
      );
      mockedService.getOrders.mockResolvedValue([makeOrder()]);

      const pending = useOrdersStore.getState().syncOrders();
      expect(useOrdersStore.getState().syncing).toBe(true);

      resolvePull();
      await pending;

      expect(useOrdersStore.getState().syncing).toBe(false);
      expect(useOrdersStore.getState().orders).toEqual([makeOrder()]);
    });

    it('guard: повторный вызов, пока синк уже идёт, — no-op (не дублирует pullOrders)', async () => {
      let resolvePull: () => void = () => undefined;
      mockedPullOrders.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolvePull = resolve;
          }),
      );
      mockedService.getOrders.mockResolvedValue([]);

      const first = useOrdersStore.getState().syncOrders();
      await useOrdersStore.getState().syncOrders();
      expect(mockedPullOrders).toHaveBeenCalledTimes(1);

      resolvePull();
      await first;
    });

    it('ошибка pull не стирает локальные данные — orders остаются как есть, только лог + тост', async () => {
      resetStore([makeOrder({ id: 'existing-order' })]);
      mockedPullOrders.mockRejectedValue(new Error('network down'));

      await useOrdersStore.getState().syncOrders();

      expect(useOrdersStore.getState().orders).toEqual([makeOrder({ id: 'existing-order' })]);
      expect(useOrdersStore.getState().error).toBeNull();
      expect(useOrdersStore.getState().syncing).toBe(false);
      expect(useToastStore.getState().toasts).toMatchObject([{ variant: ToastVariantEnum.Error }]);
    });

    it('STRESS_TEST: pullOrders не вызывается', async () => {
      let stressStore!: typeof useOrdersStore;
      let stressPullOrders!: jest.Mock;

      jest.isolateModules(() => {
        jest.doMock('../stress', () => ({
          STRESS_TEST: true,
          STRESS_TEST_COUNT: 3,
          makeStressOrders: (count: number) =>
            Array.from({ length: count }, (_, i) => makeOrder({ id: `stress-${i}` })),
        }));
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        stressStore = require('../use-orders-store').useOrdersStore;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        stressPullOrders = require('../../api').pullOrders;
      });

      await stressStore.getState().syncOrders();

      expect(stressPullOrders).not.toHaveBeenCalled();
    });
  });

  describe('bootstrapSync', () => {
    it('тот же пользователь (sync.lastUserId совпадает) — БД не очищается, только syncOrders', async () => {
      mockedService.getSyncStateValue.mockResolvedValue('user-1');
      mockedService.getOrders.mockResolvedValue([]);

      await useOrdersStore.getState().bootstrapSync('user-1');

      expect(mockedService.clearDatabase).not.toHaveBeenCalled();
      expect(mockedCancelAllReminders).not.toHaveBeenCalled();
      expect(mockedService.setSyncStateValue).not.toHaveBeenCalled();
      expect(mockedPullOrders).toHaveBeenCalledTimes(1);
    });

    it('смена пользователя — wipe: clearDatabase + cancelAllReminders + запись нового sync.lastUserId', async () => {
      mockedService.getSyncStateValue.mockResolvedValue('user-1');
      mockedService.clearDatabase.mockResolvedValue(undefined);
      mockedService.getOrders.mockResolvedValue([]);

      await useOrdersStore.getState().bootstrapSync('user-2');

      expect(mockedService.clearDatabase).toHaveBeenCalledTimes(1);
      expect(mockedCancelAllReminders).toHaveBeenCalledTimes(1);
      expect(mockedService.setSyncStateValue).toHaveBeenCalledWith(
        SyncStateKeyEnum.LastUserId,
        'user-2',
      );
      expect(mockedPullOrders).toHaveBeenCalledTimes(1);
    });

    it('первый запуск (sync.lastUserId ещё не задан) трактуется как смена пользователя — wipe', async () => {
      mockedService.getSyncStateValue.mockResolvedValue(null);
      mockedService.getOrders.mockResolvedValue([]);

      await useOrdersStore.getState().bootstrapSync('user-1');

      expect(mockedService.clearDatabase).toHaveBeenCalledTimes(1);
      expect(mockedService.setSyncStateValue).toHaveBeenCalledWith(
        SyncStateKeyEnum.LastUserId,
        'user-1',
      );
    });

    it('ошибка pull (внутри итогового syncOrders) не бросает — bootstrapSync завершается штатно', async () => {
      mockedService.getSyncStateValue.mockResolvedValue('user-1');
      mockedService.getOrders.mockResolvedValue([]);
      mockedPullOrders.mockRejectedValue(new Error('network down'));

      await expect(useOrdersStore.getState().bootstrapSync('user-1')).resolves.toBeUndefined();
    });

    it('guard: повторный вызов, пока bootstrap уже идёт, — no-op (StrictMode-дубль)', async () => {
      let resolveGetSyncState: (value: string | null) => void = (_value) => undefined;
      mockedService.getSyncStateValue.mockImplementation(
        () =>
          new Promise<string | null>((resolve) => {
            resolveGetSyncState = resolve;
          }),
      );
      mockedService.getOrders.mockResolvedValue([]);

      const first = useOrdersStore.getState().bootstrapSync('user-1');
      await useOrdersStore.getState().bootstrapSync('user-1');
      expect(mockedService.getSyncStateValue).toHaveBeenCalledTimes(1);

      resolveGetSyncState('user-1');
      await first;
    });

    it('STRESS_TEST: getSyncStateValue/pullOrders не вызываются', async () => {
      let stressStore!: typeof useOrdersStore;
      let stressService!: typeof mockedService;
      let stressPullOrders!: jest.Mock;

      jest.isolateModules(() => {
        jest.doMock('../stress', () => ({
          STRESS_TEST: true,
          STRESS_TEST_COUNT: 3,
          makeStressOrders: (count: number) =>
            Array.from({ length: count }, (_, i) => makeOrder({ id: `stress-${i}` })),
        }));
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        stressStore = require('../use-orders-store').useOrdersStore;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        stressService = require('../../api').orderDatabaseService;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        stressPullOrders = require('../../api').pullOrders;
      });

      await stressStore.getState().bootstrapSync('user-1');

      expect(stressService.getSyncStateValue).not.toHaveBeenCalled();
      expect(stressPullOrders).not.toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    // Клиентский сид демо-данных удалён (Phase 11, решение Q-04) — БД пуста до первого pull
    // (Phase 12); пустой список без ошибки — валидное состояние (EmptyState экранов).
    it('на пустой БД гидрирует пустой список заявок без ошибки', async () => {
      mockedService.initDatabase.mockResolvedValue(undefined);
      mockedService.getOrders.mockResolvedValue([]);

      await useOrdersStore.getState().initialize();

      expect(useOrdersStore.getState().orders).toEqual([]);
      expect(useOrdersStore.getState().error).toBeNull();
      expect(useOrdersStore.getState().loading).toBe(false);
    });

    it('не запускается повторно, пока идёт предыдущий вызов (guard по loading)', async () => {
      let resolveInit: () => void = () => undefined;
      mockedService.initDatabase.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveInit = resolve;
          }),
      );
      mockedService.getOrders.mockResolvedValue([]);

      const first = useOrdersStore.getState().initialize();
      const second = useOrdersStore.getState().initialize();

      resolveInit();
      await Promise.all([first, second]);

      expect(mockedService.initDatabase).toHaveBeenCalledTimes(1);
    });

    it('ошибка initDatabase → store.error выставлен, список остаётся пустым', async () => {
      mockedService.initDatabase.mockRejectedValue(new Error('db fail'));

      await useOrdersStore.getState().initialize();

      expect(useOrdersStore.getState().orders).toEqual([]);
      expect(useOrdersStore.getState().error).toBe('Не удалось загрузить заявки');
      expect(mockedService.getOrders).not.toHaveBeenCalled();
    });
  });

  // L3: под STRESS_TEST стор наполнен синтетикой мимо БД — все точки, которые обычно персистят/читают
  // через orderDatabaseService, должны быть no-op по отношению к БД (мок модуля ./stress).
  describe('STRESS_TEST guard (L3)', () => {
    it('startWork/addOrderPhoto/loadOrders/clearDatabase не обращаются к БД', async () => {
      let stressStore!: typeof useOrdersStore;
      let stressService!: typeof mockedService;

      jest.isolateModules(() => {
        jest.doMock('../stress', () => ({
          STRESS_TEST: true,
          STRESS_TEST_COUNT: 3,
          makeStressOrders: (count: number) =>
            Array.from({ length: count }, (_, i) =>
              makeOrder({ id: `stress-${i}`, status: ServiceOrderStatusEnum.New }),
            ),
        }));
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        stressStore = require('../use-orders-store').useOrdersStore;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        stressService = require('../../api').orderDatabaseService;
      });

      await stressStore.getState().initialize();
      expect(stressStore.getState().orders).toHaveLength(3);
      expect(stressService.initDatabase).not.toHaveBeenCalled();

      stressStore.getState().startWork('stress-0');
      expect(stressStore.getState().orders[0].status).toBe(ServiceOrderStatusEnum.InProgress);
      expect(stressService.updateOrderStatus).not.toHaveBeenCalled();

      // Фото добавляется/удаляется на InProgress-заявке (stress-0 после startWork) — иначе guard
      // статуса среагирует раньше STRESS-ветки и тест не проверит пропуск персиста.
      stressStore.getState().addOrderPhoto('stress-0', { uri: PHOTO_URI });
      expect(stressStore.getState().orders[0].photos).toHaveLength(1);
      expect(stressService.addOrderPhoto).not.toHaveBeenCalled();

      const [stressPhoto] = stressStore.getState().orders[0].photos;
      stressStore.getState().removeOrderPhoto('stress-0', stressPhoto.id);
      expect(stressStore.getState().orders[0].photos).toHaveLength(0);
      expect(stressService.deleteOrderPhoto).not.toHaveBeenCalled();

      await stressStore.getState().loadOrders();
      expect(stressService.getOrders).not.toHaveBeenCalled();

      await stressStore.getState().clearDatabase();
      expect(stressService.clearDatabase).not.toHaveBeenCalled();
    });
  });
});
