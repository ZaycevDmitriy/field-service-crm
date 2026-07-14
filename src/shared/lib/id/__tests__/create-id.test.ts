import * as Crypto from 'expo-crypto';

import { createId } from '../create-id';

// Мок только для этого файла — photoService.test.ts мокает `@/shared/lib/id` целиком и не должен
// затрагиваться (см. CLAUDE.md, задача 8 фазы 11).
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

const mockedRandomUUID = Crypto.randomUUID as jest.Mock;

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('createId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('делегирует генерацию Crypto.randomUUID()', () => {
    mockedRandomUUID.mockReturnValue(UUID_A);

    expect(createId()).toBe(UUID_A);
    expect(mockedRandomUUID).toHaveBeenCalledTimes(1);
  });

  it('каждый вызов возвращает результат отдельного обращения к Crypto.randomUUID() (без кеша)', () => {
    mockedRandomUUID.mockReturnValueOnce(UUID_A).mockReturnValueOnce(UUID_B);

    const first = createId();
    const second = createId();

    expect(first).not.toBe(second);
    expect(mockedRandomUUID).toHaveBeenCalledTimes(2);
  });
});
