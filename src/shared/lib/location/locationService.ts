import * as Location from 'expo-location';

import { logger } from '@/shared/lib/logger';

// Координаты работника, возвращаемые сервисом (project-agnostic; структурно совместимо с
// `app-store.ICurrentLocation`).
export interface ICoords {
  latitude: number;
  longitude: number;
}

// expo-location не поддерживает таймаут нативно (getCurrentPositionAsync может зависнуть без GPS-
// фикса); ограничиваем ожидание вручную через Promise.race.
const LOCATION_TIMEOUT_MS = 10000;

// Сервис геолокации — единственная точка доступа к нативному expo-location (FSD: нативные API в
// сервисах shared/lib, UI/стор не дёргают их напрямую). Все методы graceful: при отказе/сбое не
// бросают, а возвращают «пусто» — отказ в разрешении не блокирует флоу заявок (PDR §16).
export const locationService = {
  // Запрашивает foreground-разрешение на геолокацию. true — granted, иначе false (denied/сбой).
  async requestForegroundPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      logger.info(`[locationService.requestForegroundPermission] Статус разрешения: ${status}.`);
      if (status !== Location.PermissionStatus.GRANTED) {
        logger.warn(
          '[locationService.requestForegroundPermission] Доступ к локации не предоставлен.',
        );
      }

      return status === Location.PermissionStatus.GRANTED;
    } catch (error) {
      logger.error(
        '[locationService.requestForegroundPermission] Не удалось запросить разрешение.',
        error,
      );

      return false;
    }
  },

  // Возвращает текущие координаты или null (сбой/таймаут). Точность Balanced — компромисс
  // скорость/энергия, достаточна для дистанции «по прямой» (не для пошаговой навигации).
  async getCurrentCoords(): Promise<ICoords | null> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Location request timed out')),
            LOCATION_TIMEOUT_MS,
          );
        }),
      ]);
      const { latitude, longitude } = position.coords;
      logger.debug(`[locationService.getCurrentCoords] Координаты: ${latitude}, ${longitude}.`);

      return { latitude, longitude };
    } catch (error) {
      logger.error('[locationService.getCurrentCoords] Не удалось получить координаты.', error);

      return null;
    } finally {
      // Отменяем таймер: при выигрыше геолокации он иначе «висит» до LOCATION_TIMEOUT_MS впустую.
      clearTimeout(timeoutId);
    }
  },
};
