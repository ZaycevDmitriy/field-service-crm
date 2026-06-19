import { useEffect, useState } from 'react';

import { locationService } from './locationService';

import { useAppStore } from '@/shared/model';

// Статус получения локации — для опциональной индикации в UI. Отдельного loading-экрана нет:
// получение локации — неблокирующий фон (PDR §16), статус нужен лишь как подсказка интерфейсу.
export const LocationStatusEnum = {
  Idle: 'Idle',
  Loading: 'Loading',
  Granted: 'Granted',
  Denied: 'Denied',
  Error: 'Error',
} as const;
export type LocationStatusEnum = (typeof LocationStatusEnum)[keyof typeof LocationStatusEnum];

/**
 * Однократно запрашивает разрешение и текущие координаты, записывая их в `app-store.currentLocation`.
 *
 * Неблокирующий: отказ или сбой не мешают флоу — дистанция просто не показывается, маршрут остаётся
 * доступен (PDR §16, §21 acc. 2/3). Вызывать один раз на главном экране (dashboard); остальные
 * экраны читают готовое значение из стора.
 */
export function useCurrentLocation(): LocationStatusEnum {
  const setCurrentLocation = useAppStore((state) => state.setCurrentLocation);
  const [status, setStatus] = useState<LocationStatusEnum>(LocationStatusEnum.Idle);

  useEffect(() => {
    // Защита от записи состояния после размонтирования (эффект однократный, но запросы асинхронны).
    let cancelled = false;

    const resolveLocation = async (): Promise<void> => {
      setStatus(LocationStatusEnum.Loading);

      const granted = await locationService.requestForegroundPermission();
      if (cancelled) {
        return;
      }
      if (!granted) {
        setStatus(LocationStatusEnum.Denied);

        return;
      }

      const coords = await locationService.getCurrentCoords();
      if (cancelled) {
        return;
      }
      if (!coords) {
        setStatus(LocationStatusEnum.Error);

        return;
      }

      setCurrentLocation(coords);
      setStatus(LocationStatusEnum.Granted);
    };

    void resolveLocation();

    return () => {
      cancelled = true;
    };
  }, [setCurrentLocation]);

  return status;
}
