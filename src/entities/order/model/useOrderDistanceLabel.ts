import type { IServiceOrder } from './types';

import { formatDistanceLabel, getDistanceInKm } from '@/shared/lib/geo';
import { useAppStore } from '@/shared/model';

/**
 * Derived-лейбл дистанции от текущей локации работника до адреса заявки.
 *
 * Производное значение (PDR §13: не храним) — считается в рантайме из `app-store.currentLocation`
 * и координат заявки, реактивно к смене локации. `null` — локация недоступна (отказ/ещё не получена):
 * потребитель скрывает сегмент дистанции, остальной UI продолжает работать (PDR §16, §21 acc. 2).
 *
 * Логирование расчёта намеренно не делаем — хук вызывается в render-пути (в т.ч. в элементах списка),
 * запись в консоль на каждый рендер вредна.
 *
 * `order` допускает `null`/`undefined`, чтобы экраны с early-return (детали заявки) могли вызывать
 * хук безусловно, не нарушая правил хуков.
 */
export function useOrderDistanceLabel(order: IServiceOrder | null | undefined): string | null {
  const currentLocation = useAppStore((state) => state.currentLocation);

  if (!order || !currentLocation) {
    return null;
  }

  return formatDistanceLabel(getDistanceInKm(currentLocation, order));
}
