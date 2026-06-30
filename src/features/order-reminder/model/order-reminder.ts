import { Alert, Linking, type AlertButton } from 'react-native';

import type { IServiceOrder } from '@/entities/order';
import { logger } from '@/shared/lib/logger';
import {
  cancelOrderReminder,
  PermissionResultEnum,
  requestPermission,
  scheduleOrderReminder,
  type IReminderContent,
} from '@/shared/lib/notifications';
import { ToastVariantEnum, useToastStore } from '@/shared/model';

// Id последнего запланированного напоминания по заявке (orderId → notificationId) — для
// дедупликации: повторное подтверждение пресета отменяет предыдущее напоминание перед планированием
// нового. In-memory на время сессии приложения; переживание перезапуска требует персистентности
// reminder-id в БД — отдельная фича расширения схемы, не точечный фикс (не делаем без явного запроса).
const scheduledReminderIds = new Map<string, string>();

// Пресет-офсеты напоминания. У заявки нет реального поля даты визита (только строки scheduledTime/
// scheduledSlot), поэтому напоминание ставится относительным интервалом (TIME_INTERVAL), а не на дату
// (PDR §17.3 — «simple reminder logic»).
export interface IReminderOffset {
  label: string;
  seconds: number;
}

export const REMINDER_OFFSETS: readonly IReminderOffset[] = [
  { label: 'Через 15 минут', seconds: 15 * 60 },
  { label: 'Через 1 час', seconds: 60 * 60 },
  { label: 'Через 3 часа', seconds: 3 * 60 * 60 },
];

// Маппинг доменной заявки в минимальный контракт уведомления. Знание о заявке живёт здесь (feature),
// сегмент shared/lib/notifications остаётся business-agnostic.
function toReminderContent(order: IServiceOrder): IReminderContent {
  return {
    title: `Напоминание: ${order.title}`,
    body: `${order.client} · ${order.address}`,
  };
}

// Ставит напоминание на выбранный офсет: запрос разрешения → при отказе ведём в системные настройки,
// при успехе планируем уведомление и подтверждаем. Graceful: сбой сервиса не роняет флоу заявки.
async function scheduleWithPermission(
  order: IServiceOrder,
  offset: IReminderOffset,
): Promise<void> {
  logger.debug(`[promptOrderReminder] Выбран офсет «${offset.label}» (${offset.seconds} c).`);
  const permission = await requestPermission();
  if (permission === PermissionResultEnum.Error) {
    logger.warn('[promptOrderReminder] Сбой запроса разрешения на уведомления.');
    useToastStore.getState().showToast(ToastVariantEnum.Error, 'Не удалось запросить разрешение');

    return;
  }
  if (permission === PermissionResultEnum.Denied) {
    logger.warn('[promptOrderReminder] Разрешение не выдано — предлагаем открыть настройки.');
    Alert.alert(
      'Уведомления отключены',
      'Чтобы получать напоминания по заявке, включите уведомления в настройках.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Открыть настройки',
          onPress: () => {
            Linking.openSettings().catch((error) => {
              logger.error('[promptOrderReminder] Не удалось открыть настройки.', error);
            });
          },
        },
      ],
    );

    return;
  }

  // Дедупликация: если по этой заявке уже есть запланированное напоминание — отменяем его перед
  // постановкой нового (иначе повторное подтверждение пресета копит дубликаты).
  const existingId = scheduledReminderIds.get(order.id);
  if (existingId) {
    await cancelOrderReminder(existingId);
  }

  const id = await scheduleOrderReminder(toReminderContent(order), offset.seconds);
  if (!id) {
    Alert.alert('Не удалось', 'Не получилось запланировать напоминание. Попробуйте ещё раз.');

    return;
  }
  scheduledReminderIds.set(order.id, id);

  Alert.alert('Напоминание поставлено', `Напомним ${offset.label.toLowerCase()}.`);
}

/**
 * Открывает выбор пресета напоминания по заявке (15 минут / 1 час / 3 часа) и планирует локальное
 * уведомление. Оркестрация фичи: нативный доступ — только через notificationService (shared/lib),
 * UI лишь дёргает эту функцию по нажатию.
 */
export function promptOrderReminder(order: IServiceOrder): void {
  const buttons: AlertButton[] = [
    ...REMINDER_OFFSETS.map((offset) => ({
      text: offset.label,
      onPress: () => {
        void scheduleWithPermission(order, offset);
      },
    })),
    { text: 'Отмена', style: 'cancel' },
  ];
  Alert.alert('Когда напомнить?', order.title, buttons);
}
