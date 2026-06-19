// Гео-точка на сфере: широта/долгота в градусах. Project-agnostic тип shared/lib —
// структурно совместим с координатами заявки и `app-store.currentLocation`.
export interface IGeoPoint {
  latitude: number;
  longitude: number;
}

// Средний радиус Земли в километрах (для формулы гаверсинуса).
const EARTH_RADIUS_KM = 6371;

// Переводит градусы в радианы.
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Возвращает дистанцию между двумя гео-точками по формуле гаверсинуса (км).
 *
 * Чистая функция без сайд-эффектов — тестируема в изоляции (PDR §16, §21 acc. 4).
 * Это «дистанция по прямой», не длина маршрута (её строят внешние карты, см. features/open-route).
 */
export function getDistanceInKm(from: IGeoPoint, to: IGeoPoint): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  // Math.min(1, ...) страхует от ошибок округления под корнем (домен asin — [-1, 1]).
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));

  return EARTH_RADIUS_KM * c;
}
