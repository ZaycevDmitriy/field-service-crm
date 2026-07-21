// getDatabase кэширует соединение (промис) в модульной переменной — singleton на процесс. Каждый
// кейс поэтому заново подгружает модуль после resetModules, иначе кейсы делили бы один кэш
// (тот же паттерн, что isOtaEnabled в update-service.test.ts).
const DATABASE_MODULE_PATH = '../database';
type DatabaseModule = typeof import('../database');

const mockOpenDatabaseAsync: jest.Mock = jest.fn();

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: mockOpenDatabaseAsync }));

function loadDatabaseModule(): DatabaseModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(DATABASE_MODULE_PATH) as DatabaseModule;
}

describe('getDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('открывает соединение при первом вызове', async () => {
    const fakeDatabase = { marker: 'db-1' };
    mockOpenDatabaseAsync.mockResolvedValue(fakeDatabase);

    const { getDatabase } = loadDatabaseModule();
    const result = await getDatabase();

    expect(result).toBe(fakeDatabase);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('повторный вызов возвращает то же соединение без повторного openDatabaseAsync (singleton)', async () => {
    const fakeDatabase = { marker: 'db-1' };
    mockOpenDatabaseAsync.mockResolvedValue(fakeDatabase);

    const { getDatabase } = loadDatabaseModule();
    const first = await getDatabase();
    const second = await getDatabase();

    expect(second).toBe(first);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('при ошибке открытия сбрасывает кэш промиса — повторный вызов пробует заново', async () => {
    mockOpenDatabaseAsync.mockRejectedValueOnce(new Error('disk full'));
    const fakeDatabase = { marker: 'db-2' };
    mockOpenDatabaseAsync.mockResolvedValueOnce(fakeDatabase);

    const { getDatabase } = loadDatabaseModule();

    await expect(getDatabase()).rejects.toThrow('disk full');
    const retried = await getDatabase();

    expect(retried).toBe(fakeDatabase);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2);
  });
});
