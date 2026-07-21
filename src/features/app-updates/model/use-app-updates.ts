import * as Updates from 'expo-updates';
import { useCallback, useMemo, useState } from 'react';

import {
  getUpdateDiagnostics,
  isOtaEnabled,
  reloadApp as runReloadApp,
  checkForUpdate as runUpdateCheck,
  UpdateOutcomeEnum,
  type IStaticUpdateDiagnostics,
} from '../lib/update-service';

import { useAppStore } from '@/shared/model';

// Статическая часть диагностики (версия/канал/runtimeVersion/buildProfile) не меняется за время
// жизни процесса — читаем один раз при импорте модуля из updateService, а не из expo-constants/
// expo-updates напрямую (FSD: нативное — в сервисе, не в хуке).
const staticDiagnostics = getUpdateDiagnostics();

// Сообщение об ошибке перезагрузки (одно вхождение литерала в этом файле).
const RELOAD_ERROR = 'Не удалось перезагрузить приложение.';

export interface IUpdateDiagnostics extends IStaticUpdateDiagnostics {
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
      ...staticDiagnostics,
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
    isUpdatesEnabled: isOtaEnabled,
    isChecking: isBusy || nativeChecking || isDownloading,
    errorMessage,
    checkForUpdate,
    reloadApp,
  };
}
