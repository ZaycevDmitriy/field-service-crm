// `__DEV__` — глобал RN, jest-expo выставляет его в true. Флаг `isOtaEnabled` вычисляется на уровне
// модуля при импорте, поэтому каждый кейс задаёт `__DEV__` и `Updates.isEnabled`, затем заново
// подгружает модуль (`resetModules` в afterEach сбрасывает кэш). Имя мока с префиксом `mock` —
// требование jest для ссылки на внешнюю переменную в фабрике `jest.mock`.
const mockUpdates = { isEnabled: true };

jest.mock('expo-updates', () => mockUpdates);

interface IDevGlobal {
  __DEV__: boolean;
}

const devGlobal = globalThis as unknown as IDevGlobal;

// Типизированная подгрузка модуля после сброса кэша — без `any` от голого require.
function loadIsOtaEnabled(): boolean {
  // Динамический require: модульный флаг переоценивается только после resetModules — статический
  // import закэшировался бы и кейсы делили бы одно значение.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../updateService') as typeof import('../updateService')).isOtaEnabled;
}

describe('isOtaEnabled', () => {
  const realDev = devGlobal.__DEV__;

  afterEach(() => {
    devGlobal.__DEV__ = realDev;
    jest.resetModules();
  });

  it('false в dev-сборке, даже когда expo-updates сконфигурирован (Updates.isEnabled=true)', () => {
    devGlobal.__DEV__ = true;
    mockUpdates.isEnabled = true;

    expect(loadIsOtaEnabled()).toBe(false);
  });

  it('true в release-сборке с включённым expo-updates', () => {
    devGlobal.__DEV__ = false;
    mockUpdates.isEnabled = true;

    expect(loadIsOtaEnabled()).toBe(true);
  });

  it('false в release-сборке, если expo-updates выключен в конфигурации', () => {
    devGlobal.__DEV__ = false;
    mockUpdates.isEnabled = false;

    expect(loadIsOtaEnabled()).toBe(false);
  });
});
