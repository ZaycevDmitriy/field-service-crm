import { type CameraView } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { requestMediaLibraryPermissionAsync } from './photo-permission-service';

import { deleteFileQuietly, listDirectoryQuietly } from '@/shared/lib/fs';
import { createId } from '@/shared/lib/id';
import { logger } from '@/shared/lib/logger';

// Качество JPEG (0–1) для съёмки камерой и выбора из галереи. 0.7 — компромисс между размером
// файла и детализацией фотоотчёта; одно значение для обоих источников снимка.
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
   * Открывает галерею и возвращает URI выбранного изображения (или null при отмене/сбое/отказе).
   * Разрешение запрашивается заранее (см. photoPermissionService); современный picker его не требует,
   * но при явном отказе (legacy ОС) открывать галерею незачем — это уже финальный отказ пользователя.
   */
  async pickPhotoFromLibrary(): Promise<string | null> {
    try {
      const granted = await requestMediaLibraryPermissionAsync();
      if (!granted) {
        logger.info('[photoService.pickPhotoFromLibrary] Доступ к галерее не предоставлен.');

        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: CAPTURE_QUALITY,
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
   * Переносит временный снимок в постоянное хранилище `Paths.document/photos/<id>.<ext>` и возвращает
   * абсолютный URI. Камера/пикер пишут во временное/кэш-хранилище, которое ОС может очистить, —
   * файл в document-каталоге переживает перезапуск (PDR §15 acc. 3). Основной путь — `move`: не
   * оставляет дубль JPEG во временном хранилище. Если перенос между томами (cache→document)
   * недоступен на платформе — фоллбэк на `copy` + явное удаление исходника. При сбое ФС не роняем
   * флоу: фоллбэк на исходный временный URI.
   */
  async persistPhoto(tempUri: string): Promise<string> {
    try {
      const directory = new Directory(Paths.document, PHOTOS_DIRECTORY);
      // Идемпотентно: создаём каталог только если его ещё нет.
      if (!directory.exists) {
        directory.create({ intermediates: true });
      }
      const destination = new File(directory, `${createId()}.${getExtension(tempUri)}`);
      const source = new File(tempUri);

      try {
        await source.move(destination);
      } catch (moveError) {
        logger.debug(
          '[photoService.persistPhoto] move недоступен, фоллбэк на copy + удаление исходника.',
          moveError,
        );
        await source.copy(destination);
        deleteFileQuietly(tempUri);
      }
      logger.info('[photoService.persistPhoto] Снимок сохранён в постоянное хранилище.');

      return destination.uri;
    } catch (error) {
      logger.error('[photoService.persistPhoto] Не удалось сохранить снимок.', error);

      // Фоллбэк на временный URI: менее надёжен (кэш может очиститься), но не теряет снимок.
      return tempUri;
    }
  },
};

/**
 * Удаляет файл фото из постоянного хранилища (orphan-cleanup при отмене/пересъёмке на экране
 * предпросмотра — снимок копируется в persistPhoto ДО подтверждения пользователем). Вынесена
 * отдельной функцией (не методом photoService): это единственная операция слайса, нужная снаружи
 * (`pages/photo`), — остальной сервис остаётся приватной деталью реализации. Делегирует общий
 * helper (`shared/lib/fs`): та же логика тихого удаления нужна и `orderDatabaseService.clearDatabase`.
 */
export const deletePhoto = (uri: string): void => {
  deleteFileQuietly(uri);
};

/**
 * Удаляет из постоянного хранилища (`Paths.document/photos`) файлы, которых нет среди `knownUris`
 * (все URI фото из гидрированного стора). Сравнение — по имени файла (в БД хранится относительный
 * путь, знакомые URI — абсолютные); `mock://`-URI сидовых данных под сравнение не попадают — их
 * "имя файла" никогда не совпадёт с реальным именем на диске, поэтому просто не влияют на sweep.
 * Вызывать один раз при старте, ПОСЛЕ гидрации стора и ДО открытия экрана съёмки — иначе можно
 * снести ещё не сохранённый (не подтверждённый) снимок из активного флоу камеры.
 */
export const sweepOrphanPhotos = (knownUris: string[]): void => {
  const knownNames = new Set(knownUris.map((uri) => uri.split('/').pop()));
  const directory = new Directory(Paths.document, PHOTOS_DIRECTORY);
  const orphanNames = listDirectoryQuietly(directory).filter((name) => !knownNames.has(name));

  orphanNames.forEach((name) => deleteFileQuietly(new File(directory, name).uri));

  if (orphanNames.length > 0) {
    logger.info(
      `[photoService.sweepOrphanPhotos] Удалено осиротевших фото: ${orphanNames.length}.`,
    );
  }
};
