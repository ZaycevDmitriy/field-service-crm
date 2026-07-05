import { Directory } from 'expo-file-system';

import { logger } from '@/shared/lib/logger';

/**
 * Тихо возвращает имена файлов каталога: отсутствие каталога и сбой чтения не бросают (только лог,
 * []). Подкаталоги в результат не попадают — только файлы.
 */
export const listDirectoryQuietly = (directory: Directory): string[] => {
  try {
    if (!directory.exists) {
      return [];
    }

    return directory
      .list()
      .filter((entry) => !(entry instanceof Directory))
      .map((entry) => entry.name);
  } catch (error) {
    logger.warn('[listDirectoryQuietly] Не удалось прочитать каталог.', error);

    return [];
  }
};
