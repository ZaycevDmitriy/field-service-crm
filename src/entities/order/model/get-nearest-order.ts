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

// Type guard: заявка с заполненными координатами (сервер допускает null — Phase 11). shared/lib/geo
// остаётся строгим (не размывается null-ами) — фильтрация до вызова getDistanceInKm, здесь.
const hasCoordinates = (
  order: IServiceOrder,
): order is IServiceOrder & { latitude: number; longitude: number } =>
  order.latitude !== null && order.longitude !== null;

/**
 * Возвращает ближайшую активную заявку (статус New или InProgress). Если активных заявок нет —
 * `undefined`.
 *
 * При наличии координат работника «ближайшая» = минимальная геодистанция (Haversine) до адреса
 * заявки — из ранжирования исключаются заявки без координат (Phase 11: latitude/longitude nullable).
 * Без локации (отказ/ещё не получена), а также если ни у одной активной заявки нет координат —
 * fallback на самую раннюю по времени визита (`scheduledTime`), как в Phase 3.
 */
export function getNearestOrder(
  orders: IServiceOrder[],
  userCoords?: IGeoPoint | null,
): IServiceOrder | undefined {
  const active = orders.filter(
    (order) =>
      order.status === ServiceOrderStatusEnum.New ||
      order.status === ServiceOrderStatusEnum.InProgress,
  );

  if (active.length === 0) {
    return undefined;
  }

  // С локацией — ближайшая по геодистанции среди заявок с координатами.
  if (userCoords) {
    const withCoordinates = active.filter(hasCoordinates);
    if (withCoordinates.length > 0) {
      return withCoordinates.reduce((nearest, order) =>
        getDistanceInKm(userCoords, order) < getDistanceInKm(userCoords, nearest) ? order : nearest,
      );
    }
  }

  // Без локации (или ни у одной активной заявки нет координат) — самая ранняя по времени визита.
  return active.reduce((nearest, order) =>
    toMinutes(order.scheduledTime) < toMinutes(nearest.scheduledTime) ? order : nearest,
  );
}
