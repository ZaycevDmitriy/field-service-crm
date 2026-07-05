import { Directory, File } from 'expo-file-system';

import { listDirectoryQuietly } from '../list-directory-quietly';

import { logger } from '@/shared/lib/logger';

// Мок Directory/File: list() и exists настраиваются per-test. instanceof Directory должен работать,
// поэтому мокаем реальными классами, а не голыми объектами.
jest.mock('expo-file-system', () => {
  class MockFile {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
  }
  class MockDirectory {
    name: string;
    exists = true;
    list = jest.fn();
    constructor(name = '') {
      this.name = name;
    }
  }

  return { File: MockFile, Directory: MockDirectory };
});

describe('listDirectoryQuietly', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  it('несуществующий каталог — [] без вызова list()', () => {
    const directory = new Directory() as unknown as Directory & {
      exists: boolean;
      list: jest.Mock;
    };
    directory.exists = false;

    expect(listDirectoryQuietly(directory)).toEqual([]);
    expect(directory.list).not.toHaveBeenCalled();
  });

  it('возвращает имена только файлов, подкаталоги отфильтрованы', () => {
    const directory = new Directory() as unknown as Directory & { list: jest.Mock };
    const subDirectory = new Directory('sub');
    directory.list.mockReturnValue([new File('a.jpg'), subDirectory, new File('b.jpg')]);

    expect(listDirectoryQuietly(directory)).toEqual(['a.jpg', 'b.jpg']);
  });

  it('пустой каталог — []', () => {
    const directory = new Directory() as unknown as Directory & { list: jest.Mock };
    directory.list.mockReturnValue([]);

    expect(listDirectoryQuietly(directory)).toEqual([]);
  });

  it('исключение из list() — проглочено с логом, возвращает []', () => {
    const directory = new Directory() as unknown as Directory & { list: jest.Mock };
    directory.list.mockImplementation(() => {
      throw new Error('native fail');
    });

    expect(listDirectoryQuietly(directory)).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      '[listDirectoryQuietly] Не удалось прочитать каталог.',
      expect.any(Error),
    );
  });
});
