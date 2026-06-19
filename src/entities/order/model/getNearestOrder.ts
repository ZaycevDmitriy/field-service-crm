import { ServiceOrderStatusEnum } from './order-status';
import type { IServiceOrder } from './types';

import { getDistanceInKm, type IGeoPoint } from '@/shared/lib/geo';

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
 * Возвращает ближайшую активную заявку (статус New или InProgress). Если активных заявок нет —
 * `undefined`.
 *
 * При наличии координат работника «ближайшая» = минимальная геодистанция (Haversine) до адреса
 * заявки. Без локации (отказ/ещё не получена) — fallback на самую раннюю по времени визита
 * (`scheduledTime`), как в Phase 3.
 */
export const getNearestOrder = (
  orders: IServiceOrder[],
  userCoords?: IGeoPoint | null,
): IServiceOrder | undefined => {
  const active = orders.filter(
    (order) =>
      order.status === ServiceOrderStatusEnum.New ||
      order.status === ServiceOrderStatusEnum.InProgress,
  );

  if (active.length === 0) {
    return undefined;
  }

  // С локацией — ближайшая по геодистанции (координаты заявки структурно совместимы с IGeoPoint).
  if (userCoords) {
    return active.reduce((nearest, order) =>
      getDistanceInKm(userCoords, order) < getDistanceInKm(userCoords, nearest) ? order : nearest,
    );
  }

  // Без локации — самая ранняя по времени визита.
  return active.reduce((nearest, order) =>
    toMinutes(order.scheduledTime) < toMinutes(nearest.scheduledTime) ? order : nearest,
  );
};
