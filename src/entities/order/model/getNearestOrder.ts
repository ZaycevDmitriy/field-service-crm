import { ServiceOrderStatusEnum } from './order-status';
import type { IServiceOrder } from './types';

// Парсит время вида 'HH:mm' в минуты от полуночи. Некорректный ввод → большое число (уходит в конец сортировки).
const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':');
  const h = Number(hours);
  const m = Number(minutes);

  if (Number.isNaN(h) || Number.isNaN(m)) {
    return Number.POSITIVE_INFINITY;
  }

  return h * 60 + m;
};

/**
 * Возвращает ближайшую активную заявку (статус New или InProgress) — с минимальным `scheduledTime`.
 * Если активных заявок нет — `undefined`.
 *
 * В Phase 3 «ближайшая» = самая ранняя по времени визита. Реальная сортировка по геодистанции
 * до текущей локации появится в Phase 6.
 */
export const getNearestOrder = (orders: IServiceOrder[]): IServiceOrder | undefined => {
  const active = orders.filter(
    (order) =>
      order.status === ServiceOrderStatusEnum.New ||
      order.status === ServiceOrderStatusEnum.InProgress,
  );

  if (active.length === 0) {
    return undefined;
  }

  return active.reduce((nearest, order) =>
    toMinutes(order.scheduledTime) < toMinutes(nearest.scheduledTime) ? order : nearest,
  );
};
