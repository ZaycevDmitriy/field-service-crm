import * as SQLite from 'expo-sqlite';

import { logger } from '@/shared/lib/logger';

// Имя файла локальной SQLite-БД. Открывается лениво при первом обращении.
const DATABASE_NAME = 'onsite.db';

// Singleton-промис соединения: кэшируется в модульной переменной, поэтому повторные
// вызовы getDatabase возвращают один и тот же инстанс (одно соединение на процесс).
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Возвращает соединение с локальной SQLite-БД, открывая его при первом вызове.
 *
 * Project-agnostic: модуль знает только про файл БД и не содержит доменного SQL —
 * схема, сид и запросы заявок живут в `entities/order/api`. На native (iOS/Android)
 * работает «из коробки»; web-персист в scope Phase 4 не входит.
 */
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME)
      .then((database) => {
        logger.info('[db.getDatabase] Соединение с локальной БД открыто.');

        return database;
      })
      .catch((error) => {
        // Сбрасываем кэш, чтобы следующий вызов попытался открыть соединение заново.
        databasePromise = null;
        logger.error('[db.getDatabase] Не удалось открыть соединение с БД.', error);
        throw error;
      });
  }

  return databasePromise;
};
