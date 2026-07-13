import * as SecureStore from 'expo-secure-store';

import { SessionStatusEnum, useSessionStore } from '../../model';
import { login, refreshSession } from '../session-service';

import { httpClient } from '@/shared/api';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
}));

jest.mock('@/shared/api', () => ({
  httpClient: { post: jest.fn() },
}));

const mockedPost = httpClient.post as jest.Mock;
const mockedDeleteItem = SecureStore.deleteItemAsync as jest.Mock;

// Приводит сервис в состояние «залогинен» (refresh-токен нужен любому вызову refreshSession).
const seedLoggedInState = async (): Promise<void> => {
  mockedPost.mockResolvedValueOnce({
    data: {
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: '1', email: 'a@onsite.dev', role: 'technician', displayName: 'Техник' },
    },
  });
  await login('a@onsite.dev', 'password');
  mockedPost.mockClear();
};

describe('session-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({ status: SessionStatusEnum.Unknown, user: null });
  });

  it('refreshSession: конкурентные вызовы делают только один сетевой запрос (single-flight)', async () => {
    await seedLoggedInState();

    let resolvePost: (value: unknown) => void = () => {};
    mockedPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );

    const first = refreshSession();
    const second = refreshSession();

    resolvePost({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });
    await Promise.all([first, second]);

    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it('refreshSession: сбой сбрасывает сессию без ретрая', async () => {
    await seedLoggedInState();

    mockedPost.mockRejectedValueOnce(new Error('network down'));

    await expect(refreshSession()).rejects.toThrow('network down');

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().status).toBe(SessionStatusEnum.Unauthenticated);
    expect(useSessionStore.getState().user).toBeNull();
    expect(mockedDeleteItem).toHaveBeenCalledTimes(3);
  });
});
