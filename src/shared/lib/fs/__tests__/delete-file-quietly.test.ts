import { File } from 'expo-file-system';

import { deleteFileQuietly } from '../delete-file-quietly';

import { logger } from '@/shared/lib/logger';

// Мок File: конструктор — jest.fn(), exists/delete настраиваются per-test через mockImplementationOnce.
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ exists: true, delete: jest.fn() })),
}));

const mockedFile = File as unknown as jest.Mock;

describe('deleteFileQuietly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  it('не-file-схема (mock://) — no-op без создания File', () => {
    deleteFileQuietly('mock://order-1-photo.jpg');

    expect(mockedFile).not.toHaveBeenCalled();
  });

  it('несуществующий файл (exists=false) — no-op, delete не вызывается', () => {
    const deleteFn = jest.fn();
    mockedFile.mockImplementationOnce(() => ({ exists: false, delete: deleteFn }));

    deleteFileQuietly('file:///tmp/missing.jpg');

    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('существующий file://-файл удаляется', () => {
    const deleteFn = jest.fn();
    mockedFile.mockImplementationOnce(() => ({ exists: true, delete: deleteFn }));

    deleteFileQuietly('file:///tmp/photo.jpg');

    expect(deleteFn).toHaveBeenCalledTimes(1);
  });

  it('исключение из File — проглочено с логом, не бросает', () => {
    mockedFile.mockImplementationOnce(() => {
      throw new Error('native fail');
    });

    expect(() => deleteFileQuietly('file:///tmp/broken.jpg')).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      '[deleteFileQuietly] Не удалось удалить файл.',
      expect.any(Error),
    );
  });
});
