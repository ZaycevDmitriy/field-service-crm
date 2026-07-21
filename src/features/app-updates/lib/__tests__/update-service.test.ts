// `__DEV__` — глобал RN, jest-expo выставляет его в true. Флаг `isOtaEnabled` вычисляется на уровне
// модуля при импорте, поэтому каждый кейс задаёт `__DEV__` и `Updates.isEnabled`, затем заново
// подгружает модуль (`resetModules` в afterEach сбрасывает кэш). Имя мока с префиксом `mock` —
// требование jest для ссылки на внешнюю переменную в фабрике `jest.mock`.
const mockUpdates: { isEnabled: boolean; channel?: string; runtimeVersion?: string } = {
  isEnabled: true,
};

jest.mock('expo-updates', () => mockUpdates);

// getUpdateDiagnostics (M5) тоже вычисляется на уровне модуля при импорте — тот же паттерн
// resetModules + динамический require. Фабрика возвращает mockConstants напрямую (не { default }):
// `import Constants from 'expo-constants'` — интероп сам оборачивает default при отсутствии
// __esModule, так что Constants === mockConstants.
const mockConstants: { expoConfig?: { version?: string; extra?: { buildProfile?: string } } } = {};

jest.mock('expo-constants', () => mockConstants);

interface IDevGlobal {
  __DEV__: boolean;
}

const devGlobal = globalThis as unknown as IDevGlobal;

// Путь вынесен в константу (не только для DRY): sonarjs/no-duplicate-string считает и строковый
// литерал внутри типовых `typeof import('...')` — при трёх+ дословных повторах пути лимит пробивается.
const UPDATE_SERVICE_PATH = '../update-service';
type UpdateServiceModule = typeof import('../update-service');

// Типизированная подгрузка модуля после сброса кэша — без `any` от голого require.
function loadIsOtaEnabled(): boolean {
  // Динамический require: модульный флаг переоценивается только после resetModules — статический
  // import закэшировался бы и кейсы делили бы одно значение.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require(UPDATE_SERVICE_PATH) as UpdateServiceModule).isOtaEnabled;
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

// Типизированная подгрузка модуля после сброса кэша — без `any` от голого require.
function loadDiagnostics(): ReturnType<UpdateServiceModule['getUpdateDiagnostics']> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const freshModule = require(UPDATE_SERVICE_PATH) as UpdateServiceModule;

  return freshModule.getUpdateDiagnostics();
}

describe('getUpdateDiagnostics (M5)', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('версия/канал из конфига, buildProfile падает на channel, если extra.buildProfile не задан', () => {
    mockConstants.expoConfig = { version: '1.2.3' };
    mockUpdates.channel = 'production';
    mockUpdates.runtimeVersion = '1.0.0';

    expect(loadDiagnostics()).toEqual({
      version: '1.2.3',
      buildProfile: 'production',
      channel: 'production',
      runtimeVersion: '1.0.0',
    });
  });

  it('extra.buildProfile из EAS Build имеет приоритет над channel', () => {
    mockConstants.expoConfig = { version: '1.2.3', extra: { buildProfile: 'preview' } };
    mockUpdates.channel = 'production';
    mockUpdates.runtimeVersion = '1.0.0';

    expect(loadDiagnostics().buildProfile).toBe('preview');
  });

  it('отсутствующие version/channel/runtimeVersion — плейсхолдер "—"', () => {
    mockConstants.expoConfig = undefined;
    mockUpdates.channel = undefined;
    mockUpdates.runtimeVersion = undefined;

    expect(loadDiagnostics()).toEqual({
      version: '—',
      buildProfile: '—',
      channel: '—',
      runtimeVersion: '—',
    });
  });

  it('пустая строка channel (dev через Metro) трактуется как отсутствующая, не как ""', () => {
    mockConstants.expoConfig = { version: '1.0.0' };
    mockUpdates.channel = '';
    mockUpdates.runtimeVersion = '1.0.0';

    expect(loadDiagnostics().channel).toBe('—');
  });

  it('длинный runtimeVersion (fingerprint-хеш) укорачивается многоточием', () => {
    mockConstants.expoConfig = { version: '1.0.0' };
    mockUpdates.channel = 'production';
    mockUpdates.runtimeVersion = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

    expect(loadDiagnostics().runtimeVersion).toBe('a1b2c3d4e5f6…');
  });
});
