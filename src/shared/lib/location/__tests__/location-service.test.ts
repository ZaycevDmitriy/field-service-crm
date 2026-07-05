import * as Location from 'expo-location';

import { locationService } from '../location-service';

import { logger } from '@/shared/lib/logger';

// getCurrentCoords дёргает нативный expo-location — мокаем, чтобы управлять моментом resolve/reject.
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Balanced: 3 },
}));

jest.mock('@/shared/lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedLocation = Location as jest.Mocked<typeof Location>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

// Управляемый deferred вместо реального промиса geo — позволяет разрешить/отклонить его в нужный
// момент теста, не полагаясь на недетерминированную ловлю unhandledRejection в Jest.
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('locationService.getCurrentCoords', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('таймаут выигрывает гонку → null, поздний reject геолокации логируется через logger.debug', async () => {
    const deferred = createDeferred<Location.LocationObject>();
    mockedLocation.getCurrentPositionAsync.mockReturnValue(deferred.promise);

    const resultPromise = locationService.getCurrentCoords();
    // Даём страховочному .catch подписаться на deferred.promise до продвижения таймеров.
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(10000);
    await expect(resultPromise).resolves.toBeNull();

    expect(mockedLogger.debug).not.toHaveBeenCalled();

    // Поздний отказ геолокации — уже после того, как таймаут выиграл гонку.
    deferred.reject(new Error('GPS unavailable'));
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedLogger.debug).toHaveBeenCalledWith(
      '[locationService.getCurrentCoords] Геолокация отклонена после истечения таймаута.',
      expect.any(Error),
    );
  });

  it('геолокация выигрывает гонку → координаты, таймер снят', async () => {
    const deferred = createDeferred<Location.LocationObject>();
    mockedLocation.getCurrentPositionAsync.mockReturnValue(deferred.promise);

    const resultPromise = locationService.getCurrentCoords();

    deferred.resolve({
      coords: { latitude: 55.75, longitude: 37.62 },
    } as Location.LocationObject);

    await expect(resultPromise).resolves.toEqual({ latitude: 55.75, longitude: 37.62 });
    expect(jest.getTimerCount()).toBe(0);
  });
});
