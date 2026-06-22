import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useCallback, useMemo, useState } from 'react';

import {
  checkForUpdate as runUpdateCheck,
  reloadApp as runReloadApp,
  UpdateOutcomeEnum,
} from '../lib/updateService';

import { useAppStore } from '@/shared/model';

// Плейсхолдер недоступного значения (вынесен — иначе sonarjs/no-duplicate-string на повторах).
const EMPTY = '—';

// Статическая часть диагностики вычисляется один раз при импорте: версия из конфига и авторитетные
// значения из expo-updates (channel/runtimeVersion фиксируются нативной сборкой).
const APP_VERSION = Constants.expoConfig?.version ?? EMPTY;
const CHANNEL = Updates.channel ?? EMPTY;
const RUNTIME_VERSION = Updates.runtimeVersion ?? EMPTY;

// `extra.buildProfile` задаётся только в EAS Build (built-in EAS_BUILD_PROFILE). Локально ключ
// отсутствует → падаем на авторитетный `Updates.channel` (см. app.config.ts).
const RAW_BUILD_PROFILE: unknown = Constants.expoConfig?.extra?.buildProfile;
const BUILD_PROFILE =
  typeof RAW_BUILD_PROFILE === 'string' && RAW_BUILD_PROFILE.length > 0
    ? RAW_BUILD_PROFILE
    : CHANNEL;

// Сообщение об ошибке перезагрузки (одно вхождение литерала в этом файле).
const RELOAD_ERROR = 'Не удалось перезагрузить приложение.';

export interface IUpdateDiagnostics {
  version: string;
  buildProfile: string;
  channel: string;
  runtimeVersion: string;
  // ISO-метка последней проверки из app-store (null — проверки ещё не было).
  lastCheck: string | null;
  isUpdateAvailable: boolean;
}

export interface IUseAppUpdates {
  diagnostics: IUpdateDiagnostics;
  // false — OTA отключены (dev-клиент / Expo Go): кнопки работают как no-op.
  isUpdatesEnabled: boolean;
  // Идёт проверка или скачивание обновления.
  isChecking: boolean;
  // Текст последней ошибки (проверка/скачивание/перезагрузка), включая offline; null — ошибки нет.
  errorMessage: string | null;
  checkForUpdate: () => void;
  reloadApp: () => void;
}

// Хук диагностики и действий обновления: реактивные флаги из `Updates.useUpdates()`, императивные
// действия делегируются в updateService, время проверки пишется в app-store. Страница импортирует
// только этот хук — без прямых обращений к expo-updates / expo-constants (FSD: нативное в сервисе).
export function useAppUpdates(): IUseAppUpdates {
  const { isUpdateAvailable, isChecking: nativeChecking, isDownloading } = Updates.useUpdates();
  const lastCheck = useAppStore((state) => state.lastUpdateCheck);
  const setLastUpdateCheck = useAppStore((state) => state.setLastUpdateCheck);

  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const diagnostics = useMemo<IUpdateDiagnostics>(
    () => ({
      version: APP_VERSION,
      buildProfile: BUILD_PROFILE,
      channel: CHANNEL,
      runtimeVersion: RUNTIME_VERSION,
      lastCheck,
      isUpdateAvailable,
    }),
    [lastCheck, isUpdateAvailable],
  );

  const checkForUpdate = useCallback(() => {
    setIsBusy(true);
    setErrorMessage(null);
    runUpdateCheck()
      .then((outcome) => {
        if (outcome.status === UpdateOutcomeEnum.Failed) {
          setErrorMessage(outcome.message);
        } else if (
          outcome.status === UpdateOutcomeEnum.UpToDate ||
          outcome.status === UpdateOutcomeEnum.Updated
        ) {
          // Время фиксируем только для реально выполненной проверки (не для dev-Unavailable).
          setLastUpdateCheck(new Date().toISOString());
        }
      })
      .finally(() => setIsBusy(false));
  }, [setLastUpdateCheck]);

  const reloadApp = useCallback(() => {
    setIsBusy(true);
    setErrorMessage(null);
    runReloadApp().catch((error: unknown) => {
      // При успехе приложение перезапускается и этот код не выполнится.
      setErrorMessage(error instanceof Error ? error.message : RELOAD_ERROR);
      setIsBusy(false);
    });
  }, []);

  return {
    diagnostics,
    isUpdatesEnabled: Updates.isEnabled,
    isChecking: isBusy || nativeChecking || isDownloading,
    errorMessage,
    checkForUpdate,
    reloadApp,
  };
}
