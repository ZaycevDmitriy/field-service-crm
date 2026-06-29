import { type CameraView } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { requestMediaLibraryPermissionAsync } from './photoPermissionService';

import { createId } from '@/shared/lib/id';
import { logger } from '@/shared/lib/logger';

// Качество JPEG для съёмки (0–1). 0.7 — компромисс между размером файла и детализацией фотоотчёта.
const CAPTURE_QUALITY = 0.7;

// Подкаталог постоянного хранилища (Paths.document) для копий снимков.
const PHOTOS_DIRECTORY = 'photos';

// Извлекает расширение файла из URI (без точки). Точка учитывается только в имени файла (после
// последнего слэша). Фоллбэк 'jpg' — камера и image-picker отдают JPEG.
const getExtension = (uri: string): string => {
  const lastSlash = uri.lastIndexOf('/');
  const lastDot = uri.lastIndexOf('.');
  if (lastDot > lastSlash && lastDot < uri.length - 1) {
    return uri.slice(lastDot + 1).toLowerCase();
  }

  return 'jpg';
};

// Сервис фото — деталь реализации feature (наружу через публичный API не выносится; потребитель —
// только UI самого слайса). Инкапсулирует нативные API камеры, image-picker и файловой системы.
export const photoService = {
  /**
   * Делает снимок камерой. Принимает ref `CameraView`; готовность камеры гарантирует вызывающий
   * (шторка активна только после `onCameraReady`, решение 8). Возвращает временный URI или null при сбое.
   */
  async capturePhoto(camera: CameraView): Promise<string | null> {
    try {
      const result = await camera.takePictureAsync({ quality: CAPTURE_QUALITY });
      logger.info('[photoService.capturePhoto] Снимок сделан.');

      return result?.uri ?? null;
    } catch (error) {
      logger.error('[photoService.capturePhoto] Не удалось сделать снимок.', error);

      return null;
    }
  },

  /**
   * Открывает галерею и возвращает URI выбранного изображения (или null при отмене/сбое).
   * Разрешение запрашивается заранее (см. photoPermissionService); современный picker его не требует.
   */
  async pickPhotoFromLibrary(): Promise<string | null> {
    try {
      await requestMediaLibraryPermissionAsync();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled) {
        logger.info('[photoService.pickPhotoFromLibrary] Выбор отменён.');

        return null;
      }

      const uri = result.assets?.[0]?.uri ?? null;
      logger.info('[photoService.pickPhotoFromLibrary] Изображение выбрано.');

      return uri;
    } catch (error) {
      logger.error('[photoService.pickPhotoFromLibrary] Не удалось выбрать изображение.', error);

      return null;
    }
  },

  /**
   * Копирует временный снимок в постоянное хранилище `Paths.document/photos/<id>.<ext>` и возвращает
   * абсолютный URI копии. Камера/пикер пишут во временное/кэш-хранилище, которое ОС может очистить, —
   * копия в document-каталоге переживает перезапуск (PDR §15 acc. 3). FS-методы `create`/`copy`
   * синхронные. При сбое ФС не роняем флоу: фоллбэк на исходный временный URI.
   */
  async persistPhoto(tempUri: string): Promise<string> {
    try {
      const directory = new Directory(Paths.document, PHOTOS_DIRECTORY);
      // Идемпотентно: создаём каталог только если его ещё нет.
      if (!directory.exists) {
        directory.create({ intermediates: true });
      }
      const destination = new File(directory, `${createId()}.${getExtension(tempUri)}`);
      new File(tempUri).copy(destination);
      logger.info('[photoService.persistPhoto] Снимок сохранён в постоянное хранилище.');

      return destination.uri;
    } catch (error) {
      logger.error('[photoService.persistPhoto] Не удалось сохранить снимок.', error);

      // Фоллбэк на временный URI: менее надёжен (кэш может очиститься), но не теряет снимок.
      return tempUri;
    }
  },
};
