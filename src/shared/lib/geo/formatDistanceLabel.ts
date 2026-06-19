/**
 * Форматирует дистанцию в км в человекочитаемый лейбл.
 *
 * До 1 км — в метрах с округлением до 10 м («350 м»), от 1 км — один знак после запятой («4.2 км»).
 * Чистая функция (PDR §21 acc. 4).
 */
export function formatDistanceLabel(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round((distanceKm * 1000) / 10) * 10;

    return `${meters} м`;
  }

  return `${distanceKm.toFixed(1)} км`;
}
