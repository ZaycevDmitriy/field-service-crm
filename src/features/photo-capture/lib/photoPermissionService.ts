import * as ImagePicker from 'expo-image-picker';

/**
 * Запрашивает разрешение на доступ к медиабиблиотеке (галерее).
 *
 * Нюанс: на современных iOS (PHPicker) и Android (Photo Picker) `launchImageLibraryAsync`
 * НЕ требует этого разрешения — Expo убрал `READ_MEDIA_IMAGES`. Запрос оставлен ради обработки
 * отказа по PDR §15 (acc. 2); на новых ОС ветка «отказано» практически недостижима.
 *
 * Разрешение камеры здесь не дублируется — оно реактивно через хук `useCameraPermissions` в UI.
 * Ошибку не пробрасываем: флоу не должен падать из-за сбоя запроса (возвращаем false).
 */
export async function requestMediaLibraryPermissionAsync(): Promise<boolean> {
  try {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.info(
      `[photoPermissionService.requestMediaLibrary] Статус разрешения галереи: ${result.status}.`,
    );

    return result.granted;
  } catch (error) {
    console.error(
      '[photoPermissionService.requestMediaLibrary] Не удалось запросить разрешение галереи.',
      error,
    );

    return false;
  }
}
