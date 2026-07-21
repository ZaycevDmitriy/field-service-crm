import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { logger } from '@/shared/lib/logger';

const LOG_TAG = '[updateService]';

export const isOtaEnabled = Updates.isEnabled && !__DEV__;

// Разовый диагностический лог при загрузке модуля: видно, почему бейдж в dev показывает «Недоступно в dev».
logger.info(
  `${LOG_TAG} OTA доступность: Updates.isEnabled=${Updates.isEnabled}, __DEV__=${__DEV__} → isOtaEnabled=${isOtaEnabled}`,
);

// Плейсхолдер недоступного значения (вынесен — иначе sonarjs/no-duplicate-string на повторах).
const EMPTY = '—';

// '—' для отсутствующего ИЛИ пустого значения: в dev через Metro `Updates.channel` отдаёт пустую
// строку '', которую `?? EMPTY` не ловит (только null/undefined).
function orEmpty(value: string | null | undefined): string {
  return value && value.length > 0 ? value : EMPTY;
}

// Длинный fingerprint-хеш (40 символов) укорачиваем для строки диагностики — иначе label «Runtime
// version» ломается по буквам. Короткие значения (политики/версии вида 1.0.0) показываем целиком.
function shortenRuntime(value: string): string {
  return value.length > 16 ? `${value.slice(0, 12)}…` : value;
}

// Статическая часть диагностики вычисляется один раз при импорте: версия из конфига и авторитетные
// значения из expo-updates (channel/runtimeVersion фиксируются нативной сборкой).
const APP_VERSION = Constants.expoConfig?.version ?? EMPTY;
const CHANNEL = orEmpty(Updates.channel);
const RUNTIME_VERSION = shortenRuntime(orEmpty(Updates.runtimeVersion));

// `extra.buildProfile` задаётся только в EAS Build (built-in EAS_BUILD_PROFILE). Локально/в dev ключ
// отсутствует → падаем на авторитетный `Updates.channel` (см. app.config.ts).
const RAW_BUILD_PROFILE: unknown = Constants.expoConfig?.extra?.buildProfile;
const BUILD_PROFILE =
  typeof RAW_BUILD_PROFILE === 'string' && RAW_BUILD_PROFILE.length > 0
    ? RAW_BUILD_PROFILE
    : CHANNEL;

export interface IStaticUpdateDiagnostics {
  version: string;
  buildProfile: string;
  channel: string;
  runtimeVersion: string;
}

// Статическая (не-React) диагностика сборки: версия/канал/runtimeVersion/buildProfile не меняются
// после запуска процесса, поэтому вычислены один раз при импорте модуля (см. константы выше).
// Реактивные isUpdateAvailable/lastCheck остаются в useAppUpdates — это React-хук (Updates.useUpdates()),
// в lib-сегмент не переносится.
export function getUpdateDiagnostics(): IStaticUpdateDiagnostics {
  return {
    version: APP_VERSION,
    buildProfile: BUILD_PROFILE,
    channel: CHANNEL,
    runtimeVersion: RUNTIME_VERSION,
  };
}

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
    // Полный объект ошибки — только в лог; в UI (Settings через useAppUpdates) уходит фиксированное
    // сообщение без технических деталей (сырой error.message мог содержать нативный текст expo-updates).
    logger.error(`${LOG_TAG} checkForUpdate: ошибка →`, error);
    return { status: UpdateOutcomeEnum.Failed, message: 'Не удалось проверить обновления.' };
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
    // Полный объект ошибки — только в лог; вызывающему (useAppUpdates → Settings) уходит фиксированное
    // сообщение без технических деталей (сырой error.message мог содержать нативный текст expo-updates).
    logger.error(`${LOG_TAG} reloadApp: ошибка →`, error);
    throw new Error('Не удалось перезагрузить приложение.');
  }
}
