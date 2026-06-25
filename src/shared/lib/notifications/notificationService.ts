import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@/shared/lib/logger';

// Минимальный контракт контента напоминания. Business-agnostic: сегмент shared не знает про entity
// order — маппинг IServiceOrder → IReminderContent живёт выше, в features/order-reminder.
export interface IReminderContent {
  title: string;
  body: string;
}

// Идентификатор Android-канала напоминаний. Android 8+ требует канал, иначе уведомление не покажется.
const ORDER_REMINDERS_CHANNEL_ID = 'order-reminders';

// Module-level: как приложение показывает уведомление на переднем плане. Ключи shouldShowBanner/
// shouldShowList обязательны для SDK 54+ (устаревший shouldShowAlert не используем). Звук и бейдж для
// напоминаний по заявке не нужны. Хендлер ставится при импорте модуля (см. init в src/app/_layout).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Создаёт Android-канал «order-reminders» (idempotent: setNotificationChannelAsync создаёт или
 * обновляет). На iOS каналов нет — no-op. Вызывать при старте, до первого планирования.
 */
export async function configureNotifications(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync(ORDER_REMINDERS_CHANNEL_ID, {
      name: 'Напоминания по заявкам',
      importance: Notifications.AndroidImportance.HIGH,
    });
    logger.info('[notificationService.configureNotifications] Канал order-reminders готов.');
  } catch (error) {
    logger.error('[notificationService.configureNotifications] Не удалось создать канал.', error);
  }
}

/**
 * Запрашивает разрешение на уведомления (graceful): true — granted, иначе false (denied/сбой). Сначала
 * читает текущий статус и запрашивает только если ещё не granted. На Android 13+ это же вызывает
 * системный запрос POST_NOTIFICATIONS.
 */
export async function requestPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    logger.info(`[notificationService.requestPermission] Статус разрешения: ${finalStatus}.`);
    if (finalStatus !== 'granted') {
      logger.warn(
        '[notificationService.requestPermission] Разрешение на уведомления не предоставлено.',
      );
    }

    return finalStatus === 'granted';
  } catch (error) {
    logger.error('[notificationService.requestPermission] Не удалось запросить разрешение.', error);

    return false;
  }
}

/**
 * Планирует локальное напоминание через `seconds` секунд (TIME_INTERVAL). Возвращает id уведомления
 * или null при сбое (graceful — не бросает). channelId привязывает уведомление к Android-каналу
 * order-reminders (на iOS поле игнорируется).
 */
export async function scheduleOrderReminder(
  content: IReminderContent,
  seconds: number,
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: ORDER_REMINDERS_CHANNEL_ID,
      },
    });
    logger.info(
      `[notificationService.scheduleOrderReminder] Напоминание ${id} запланировано через ${seconds} c.`,
    );

    return id;
  } catch (error) {
    logger.error('[notificationService.scheduleOrderReminder] Не удалось запланировать.', error);

    return null;
  }
}
