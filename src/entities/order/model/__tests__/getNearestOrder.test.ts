import { getNearestOrder } from '../getNearestOrder';
import { ServiceOrderStatusEnum } from '../order-status';
import type { IServiceOrder } from '../types';

// Фабрика фикстур: дефолт — активная заявка, нужные поля переопределяются через overrides.
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

describe('getNearestOrder', () => {
  it('возвращает undefined, когда заявок нет', () => {
    expect(getNearestOrder([])).toBeUndefined();
  });

  it('возвращает undefined, когда все заявки завершены или отменены', () => {
    const orders = [
      makeOrder({ id: 'done', status: ServiceOrderStatusEnum.Done }),
      makeOrder({ id: 'cancelled', status: ServiceOrderStatusEnum.Cancelled }),
    ];
    expect(getNearestOrder(orders)).toBeUndefined();
  });

  it('без локации возвращает самую раннюю по времени визита', () => {
    const orders = [
      makeOrder({ id: 'late', scheduledTime: '15:30' }),
      makeOrder({ id: 'early', scheduledTime: '08:15' }),
      makeOrder({ id: 'mid', scheduledTime: '11:00' }),
    ];
    expect(getNearestOrder(orders)?.id).toBe('early');
    // null трактуется так же, как отсутствие локации.
    expect(getNearestOrder(orders, null)?.id).toBe('early');
  });

  it('без локации отправляет заявки с невалидным временем в конец', () => {
    const orders = [
      makeOrder({ id: 'broken', scheduledTime: 'не время' }),
      makeOrder({ id: 'valid', scheduledTime: '10:00' }),
    ];
    expect(getNearestOrder(orders)?.id).toBe('valid');
  });

  it('с локацией возвращает ближайшую по геодистанции, игнорируя время', () => {
    const userCoords = { latitude: 55.0, longitude: 37.0 };
    const orders = [
      // Самая ранняя по времени, но географически далёкая.
      makeOrder({ id: 'far', scheduledTime: '08:00', latitude: 60.0, longitude: 30.0 }),
      // Поздняя по времени, но рядом с работником.
      makeOrder({ id: 'near', scheduledTime: '20:00', latitude: 55.05, longitude: 37.05 }),
    ];
    expect(getNearestOrder(orders, userCoords)?.id).toBe('near');
  });

  it('исключает завершённые и отменённые, выбирая среди активных', () => {
    const userCoords = { latitude: 55.0, longitude: 37.0 };
    const orders = [
      // Точно в координатах работника (дистанция 0), но завершена → исключается.
      makeOrder({
        id: 'done-here',
        status: ServiceOrderStatusEnum.Done,
        latitude: 55.0,
        longitude: 37.0,
      }),
      makeOrder({
        id: 'active-far',
        status: ServiceOrderStatusEnum.InProgress,
        latitude: 55.5,
        longitude: 37.5,
      }),
    ];
    expect(getNearestOrder(orders, userCoords)?.id).toBe('active-far');
  });
});
