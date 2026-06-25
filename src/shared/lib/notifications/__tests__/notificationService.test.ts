import { PermissionStatus } from 'expo-notifications';

import { mapPermissionStatus, PermissionResultEnum } from '../notificationService';

// notificationService на уровне модуля вызывает setNotificationHandler — мокаем expo-notifications,
// чтобы импорт не дёргал нативный модуль. Заодно отдаём enum PermissionStatus для типобезопасных входов.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

describe('mapPermissionStatus', () => {
  it('granted → Granted', () => {
    expect(mapPermissionStatus(PermissionStatus.GRANTED)).toBe(PermissionResultEnum.Granted);
  });

  it.each([PermissionStatus.DENIED, PermissionStatus.UNDETERMINED])('%s → Denied', (status) => {
    expect(mapPermissionStatus(status)).toBe(PermissionResultEnum.Denied);
  });
});
