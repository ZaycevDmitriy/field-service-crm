import { Linking, Platform } from 'react-native';

import { logger } from '@/shared/lib/logger';
import { useAppStore } from '@/shared/model';

// Точка назначения маршрута — координаты адреса заявки (минимальный контракт, без связи с entity).
export interface IRouteDestination {
  latitude: number;
  longitude: number;
}

// Схема приложения Яндекс.Карт — для проверки установленного приложения на iOS
// (зарегистрирована в ios.infoPlist.LSApplicationQueriesSchemes).
const YANDEX_APP_SCHEME = 'yandexmaps://';

// Собирает rtext Яндекса: «origin~destination», либо «~destination» при отсутствии локации —
// тогда Яндекс строит маршрут от текущего положения сам (кнопка работает даже без разрешения, §21 acc.3).
// Координаты — числа, поэтому raw без URL-кодирования (формат Яндекса: lat,lon~lat,lon).
const buildRtext = (destination: IRouteDestination, origin: IRouteDestination | null): string => {
  const dest = `${destination.latitude},${destination.longitude}`;

  return origin ? `${origin.latitude},${origin.longitude}~${dest}` : `~${dest}`;
};

/**
 * Открывает маршрут до заявки во внешних Яндекс.Картах: deep link в приложение, иначе web-fallback.
 *
 * Origin — текущая локация работника из app-store (не реактивно: читается в момент нажатия). Стратегия:
 * на iOS проверяем установленное приложение через canOpenURL (нужна регистрация схемы), на Android
 * canOpenURL без `<queries>` ненадёжен → сразу пробуем deep link, web — в catch (PDR, решение 6).
 */
export async function openMapsRoute(destination: IRouteDestination): Promise<void> {
  const origin = useAppStore.getState().currentLocation;
  const query = `rtext=${buildRtext(destination, origin)}&rtt=auto`;
  const deepLink = `yandexmaps://maps.yandex.ru/?${query}`;
  const webUrl = `https://yandex.ru/maps/?${query}`;

  try {
    if (Platform.OS === 'ios') {
      const isYandexInstalled = await Linking.canOpenURL(YANDEX_APP_SCHEME);
      logger.debug(`[openMapsRoute] Яндекс.Карты установлены (iOS): ${isYandexInstalled}.`);
      await Linking.openURL(isYandexInstalled ? deepLink : webUrl);

      return;
    }

    // Android: пробуем приложение, при сбое — web (см. catch).
    await Linking.openURL(deepLink);
  } catch (error) {
    logger.warn('[openMapsRoute] Deep link не открылся, fallback на web.', error);
    try {
      await Linking.openURL(webUrl);
    } catch (webError) {
      logger.error('[openMapsRoute] Не удалось открыть карты.', webError);
    }
  }
}
