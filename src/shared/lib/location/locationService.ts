import * as Location from 'expo-location';

// Координаты работника, возвращаемые сервисом (project-agnostic; структурно совместимо с
// `app-store.ICurrentLocation`).
export interface ICoords {
  latitude: number;
  longitude: number;
}

// Сервис геолокации — единственная точка доступа к нативному expo-location (FSD: нативные API в
// сервисах shared/lib, UI/стор не дёргают их напрямую). Все методы graceful: при отказе/сбое не
// бросают, а возвращают «пусто» — отказ в разрешении не блокирует флоу заявок (PDR §16).
export const locationService = {
  // Запрашивает foreground-разрешение на геолокацию. true — granted, иначе false (denied/сбой).
  async requestForegroundPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.info(`[locationService.requestForegroundPermission] Статус разрешения: ${status}.`);
      if (status !== Location.PermissionStatus.GRANTED) {
        console.warn(
          '[locationService.requestForegroundPermission] Доступ к локации не предоставлен.',
        );
      }

      return status === Location.PermissionStatus.GRANTED;
    } catch (error) {
      console.error(
        '[locationService.requestForegroundPermission] Не удалось запросить разрешение.',
        error,
      );

      return false;
    }
  },

  // Возвращает текущие координаты или null (сбой). Точность Balanced — компромисс скорость/энергия,
  // достаточна для дистанции «по прямой» (не для пошаговой навигации).
  async getCurrentCoords(): Promise<ICoords | null> {
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      console.debug(`[locationService.getCurrentCoords] Координаты: ${latitude}, ${longitude}.`);

      return { latitude, longitude };
    } catch (error) {
      console.error('[locationService.getCurrentCoords] Не удалось получить координаты.', error);

      return null;
    }
  },
};
