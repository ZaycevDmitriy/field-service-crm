import { OrderFilterEnum, type IServiceOrder } from '@/entities/order';

/**
 * Фильтрует заявки по статусу и поисковому запросу. Чистая функция (тесты — Phase 9).
 *
 * - Статус: `All` — без сужения; иначе оставляем заявки с `status === filter`.
 * - Поиск: подстрока (case-insensitive) в `client` или `address`; пустой запрос — без сужения.
 */
export const getFilteredOrders = (
  orders: IServiceOrder[],
  filter: OrderFilterEnum,
  search: string,
): IServiceOrder[] => {
  const query = search.trim().toLowerCase();

  return orders.filter((order) => {
    const matchesStatus = filter === OrderFilterEnum.All || order.status === filter;
    const matchesSearch =
      query.length === 0 ||
      order.client.toLowerCase().includes(query) ||
      order.address.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });
};
