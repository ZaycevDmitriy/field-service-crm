import { orderDatabaseService } from '../../api';
import { ServiceOrderStatusEnum } from '../order-status';
import type { IServiceOrder } from '../types';
import { useOrdersStore } from '../useOrdersStore';

// Изолируем стор от SQLite: orderDatabaseService — единственная сторонняя зависимость guard-ов
// и переходов статуса, которые тестируются здесь.
jest.mock('../../api', () => ({
  orderDatabaseService: {
    initDatabase: jest.fn(),
    seedDatabaseIfNeeded: jest.fn(),
    getOrders: jest.fn(),
    updateOrderStatus: jest.fn(),
    addOrderPhoto: jest.fn(),
    clearDatabase: jest.fn(),
  },
}));

const mockedService = orderDatabaseService as jest.Mocked<typeof orderDatabaseService>;

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
  useOrdersStore.setState({ orders, loading: false, error: null });

describe('useOrdersStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.updateOrderStatus.mockResolvedValue(undefined);
    mockedService.addOrderPhoto.mockResolvedValue(undefined);
    resetStore();
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
  });

  describe('addOrderPhoto', () => {
    const PHOTO_URI = 'file://photo.jpg';

    it('добавляет фото и обрезает комментарий', () => {
      resetStore([makeOrder()]);

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
        resetStore([makeOrder()]);

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
  });
});
