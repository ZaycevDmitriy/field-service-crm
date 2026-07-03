import { File } from 'expo-file-system';

import { logger } from '@/shared/lib/logger';

/**
 * Тихо удаляет файл по file://-URI: отсутствие файла и сбой удаления не бросают (только лог).
 * URI с другой схемой (mock://, http(s)://) — no-op: это не файлы на диске.
 */
export const deleteFileQuietly = (uri: string): void => {
  if (!uri.startsWith('file://')) {
    return;
  }
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    logger.error('[deleteFileQuietly] Не удалось удалить файл.', error);
  }
};
