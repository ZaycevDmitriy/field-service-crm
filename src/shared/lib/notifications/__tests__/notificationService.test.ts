import * as Notifications from 'expo-notifications';
import { PermissionStatus } from 'expo-notifications';

import {
  cancelAllReminders,
  cancelOrderRemindersByKey,
  mapPermissionStatus,
  PermissionResultEnum,
  scheduleOrderReminder,
} from '../notificationService';

// notificationService на уровне модуля вызывает setNotificationHandler — мокаем expo-notifications,
// чтобы импорт не дёргал нативный модуль. Заодно отдаём enum PermissionStatus для типобезопасных входов.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;
const DEDUP_KEY = 'order-1';
const NATIVE_FAIL_MESSAGE = 'native fail';

describe('mapPermissionStatus', () => {
  it('granted → Granted', () => {
    expect(mapPermissionStatus(PermissionStatus.GRANTED)).toBe(PermissionResultEnum.Granted);
  });

  it.each([PermissionStatus.DENIED, PermissionStatus.UNDETERMINED])('%s → Denied', (status) => {
    expect(mapPermissionStatus(status)).toBe(PermissionResultEnum.Denied);
  });
});

describe('scheduleOrderReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('передаёт dedupKey в content.data планировщика', async () => {
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('notif-1');

    const id = await scheduleOrderReminder({ title: 'T', body: 'B' }, 900, DEDUP_KEY);

    expect(id).toBe('notif-1');
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ data: { dedupKey: DEDUP_KEY } }),
      }),
    );
  });

  it('graceful: сбой планирования возвращает null, а не бросает', async () => {
    mockedNotifications.scheduleNotificationAsync.mockRejectedValue(new Error(NATIVE_FAIL_MESSAGE));

    await expect(
      scheduleOrderReminder({ title: 'T', body: 'B' }, 900, DEDUP_KEY),
    ).resolves.toBeNull();
  });
});

describe('cancelOrderRemindersByKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('отменяет только запросы с совпадающим dedupKey, пропускает exceptId и чужие ключи', async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'a', content: { data: { dedupKey: DEDUP_KEY } } },
      { identifier: 'b', content: { data: { dedupKey: DEDUP_KEY } } },
      { identifier: 'c', content: { data: { dedupKey: 'order-2' } } },
    ] as unknown as Notifications.NotificationRequest[]);

    await cancelOrderRemindersByKey(DEDUP_KEY, 'a');

    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('b');
  });

  it('graceful: сбой чтения расписания не бросает', async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockRejectedValue(
      new Error(NATIVE_FAIL_MESSAGE),
    );

    await expect(cancelOrderRemindersByKey(DEDUP_KEY)).resolves.toBeUndefined();
  });
});

describe('cancelAllReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('вызывает cancelAllScheduledNotificationsAsync', async () => {
    mockedNotifications.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);

    await cancelAllReminders();

    expect(mockedNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('graceful: сбой отмены не бросает', async () => {
    mockedNotifications.cancelAllScheduledNotificationsAsync.mockRejectedValue(
      new Error(NATIVE_FAIL_MESSAGE),
    );

    await expect(cancelAllReminders()).resolves.toBeUndefined();
  });
});
