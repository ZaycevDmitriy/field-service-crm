import { getFilteredOrders } from '../getFilteredOrders';

import { OrderFilterEnum, ServiceOrderStatusEnum, type IServiceOrder } from '@/entities/order';

// Фабрика фикстур: дефолт переопределяется через overrides.
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

const orders: IServiceOrder[] = [
  makeOrder({
    id: 'n1',
    status: ServiceOrderStatusEnum.New,
    client: 'Иванов',
    address: 'ул. Ленина, 1',
  }),
  makeOrder({
    id: 'p1',
    status: ServiceOrderStatusEnum.InProgress,
    client: 'Петров',
    address: 'пр. Мира, 5',
  }),
  makeOrder({
    id: 'd1',
    status: ServiceOrderStatusEnum.Done,
    client: 'Сидоров',
    address: 'ул. Ленина, 9',
  }),
  makeOrder({
    id: 'c1',
    status: ServiceOrderStatusEnum.Cancelled,
    client: 'Кузнецов',
    address: 'наб. Реки',
  }),
];

describe('getFilteredOrders', () => {
  it('All без поиска возвращает все заявки', () => {
    expect(getFilteredOrders(orders, OrderFilterEnum.All, '')).toHaveLength(orders.length);
  });

  it('фильтрует по конкретному статусу', () => {
    const result = getFilteredOrders(orders, OrderFilterEnum.New, '');
    expect(result.map((order) => order.id)).toEqual(['n1']);
  });

  it('ищет по клиенту без учёта регистра и с обрезкой пробелов', () => {
    const result = getFilteredOrders(orders, OrderFilterEnum.All, '  ПЕТРОВ  ');
    expect(result.map((order) => order.id)).toEqual(['p1']);
  });

  it('ищет по адресу как по подстроке', () => {
    const result = getFilteredOrders(orders, OrderFilterEnum.All, 'ленина');
    expect(result.map((order) => order.id)).toEqual(['n1', 'd1']);
  });

  it('комбинирует статус и поиск', () => {
    const result = getFilteredOrders(orders, OrderFilterEnum.Done, 'ленина');
    expect(result.map((order) => order.id)).toEqual(['d1']);
  });

  it('возвращает пустой массив, когда ничего не совпало', () => {
    expect(getFilteredOrders(orders, OrderFilterEnum.All, 'нет такого')).toEqual([]);
  });
});
