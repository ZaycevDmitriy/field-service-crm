import * as Updates from 'expo-updates';

import { logger } from '@/shared/lib/logger';

const LOG_TAG = '[updateService]';

export const isOtaEnabled = Updates.isEnabled && !__DEV__;

// Разовый диагностический лог при загрузке модуля: видно, почему бейдж в dev показывает «Недоступно в dev».
logger.info(
  `${LOG_TAG} OTA доступность: Updates.isEnabled=${Updates.isEnabled}, __DEV__=${__DEV__} → isOtaEnabled=${isOtaEnabled}`,
);

// Итог операции проверки обновления. Хук использует его для UI-состояния и записи времени проверки.
export const UpdateOutcomeEnum = {
  // Скачано новое обновление (или откат к встроенному) — требуется перезагрузка.
  Updated: 'Updated',
  // Проверка прошла, приложение уже на актуальной версии.
  UpToDate: 'UpToDate',
  // OTA-обновления отключены (dev-клиент / Expo Go): нативный API недоступен.
  Unavailable: 'Unavailable',
  // Проверка или скачивание завершились ошибкой (в том числе отсутствие сети).
  Failed: 'Failed',
} as const;
export type UpdateOutcomeEnum = (typeof UpdateOutcomeEnum)[keyof typeof UpdateOutcomeEnum];

export interface IUpdateCheckOutcome {
  status: UpdateOutcomeEnum;
  // Человекочитаемая причина для статусов Unavailable/Failed; null — когда пояснение не требуется.
  message: string | null;
}

// dev-guard: в dev-сборке/Expo Go OTA недоступны (`isOtaEnabled === false`), а async-методы
// expo-updates отклоняются. Поэтому сперва проверяем флаг, затем оборачиваем сетевые вызовы в try/catch.
export async function checkForUpdate(): Promise<IUpdateCheckOutcome> {
  logger.info(`${LOG_TAG} checkForUpdate: старт, isOtaEnabled =`, isOtaEnabled);

  if (!isOtaEnabled) {
    logger.info(`${LOG_TAG} checkForUpdate: OTA отключены → Unavailable`);
    return {
      status: UpdateOutcomeEnum.Unavailable,
      message: 'Обновления доступны только в сборке EAS, не в режиме разработки.',
    };
  }

  try {
    const check = await Updates.checkForUpdateAsync();
    logger.info(`${LOG_TAG} checkForUpdate: проверка завершена, isAvailable =`, check.isAvailable);

    if (!check.isAvailable && !check.isRollBackToEmbedded) {
      return { status: UpdateOutcomeEnum.UpToDate, message: null };
    }

    logger.info(`${LOG_TAG} checkForUpdate: найдено обновление, скачиваю`);
    const fetched = await Updates.fetchUpdateAsync();
    logger.info(`${LOG_TAG} checkForUpdate: скачивание завершено, isNew =`, fetched.isNew);

    if (fetched.isNew || fetched.isRollBackToEmbedded) {
      return { status: UpdateOutcomeEnum.Updated, message: null };
    }

    // Проверка нашла обновление, но скачивать оказалось нечего — считаем версию актуальной.
    return { status: UpdateOutcomeEnum.UpToDate, message: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось проверить обновления.';
    logger.error(`${LOG_TAG} checkForUpdate: ошибка →`, message);
    return { status: UpdateOutcomeEnum.Failed, message };
  }
}

// Перезагрузка в скачанное обновление. В dev — no-op (OTA отключены). Ошибку пробрасываем хуку.
export async function reloadApp(): Promise<void> {
  logger.info(`${LOG_TAG} reloadApp: старт, isOtaEnabled =`, isOtaEnabled);

  if (!isOtaEnabled) {
    logger.info(`${LOG_TAG} reloadApp: OTA отключены → no-op`);
    throw new Error('Обновления доступны только в сборке EAS, не в режиме разработки.');
  }

  try {
    await Updates.reloadAsync();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось перезагрузить приложение.';
    logger.error(`${LOG_TAG} reloadApp: ошибка →`, message);
    throw error instanceof Error ? error : new Error(message);
  }
}
