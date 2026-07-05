import { useEffect } from 'react';

import { locationService } from './location-service';

import { useAppStore } from '@/shared/model';

/**
 * Однократно запрашивает разрешение и текущие координаты, записывая их в `app-store.currentLocation`.
 *
 * Неблокирующий: отказ или сбой не мешают флоу — дистанция просто не показывается, маршрут остаётся
 * доступен (PDR §16, §21 acc. 2/3). Вызывать один раз на главном экране (dashboard); остальные
 * экраны читают готовое значение из стора.
 */
export function useCurrentLocation(): void {
  const setCurrentLocation = useAppStore((state) => state.setCurrentLocation);

  useEffect(() => {
    // Защита от записи состояния после размонтирования (эффект однократный, но запросы асинхронны).
    let cancelled = false;

    const resolveLocation = async (): Promise<void> => {
      const granted = await locationService.requestForegroundPermission();
      if (cancelled || !granted) {
        return;
      }

      const coords = await locationService.getCurrentCoords();
      if (cancelled || !coords) {
        return;
      }

      setCurrentLocation(coords);
    };

    void resolveLocation();

    return () => {
      cancelled = true;
    };
  }, [setCurrentLocation]);
}
