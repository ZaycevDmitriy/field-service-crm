import { sweepOrphanPhotos } from '../photoService';

import { deleteFileQuietly, listDirectoryQuietly } from '@/shared/lib/fs';

// Импорт модуля под тестом — после моков (иначе тянет реальный expo-file-system при инициализации).

// Минимальный мок expo-file-system: sweepOrphanPhotos не трогает реальный диск — только строит
// Directory/File-пути (uri) для listDirectoryQuietly/deleteFileQuietly, которые мокнуты отдельно.
jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;

    constructor(...args: [{ uri: string }, string]) {
      this.uri = `${args[0].uri}${args[1]}/`;
    }
  }

  class MockFile {
    uri: string;

    constructor(directory: MockDirectory, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
  }

  return {
    Paths: { document: { uri: 'file:///mock-document/' } },
    Directory: MockDirectory,
    File: MockFile,
  };
});

jest.mock('@/shared/lib/fs', () => ({
  deleteFileQuietly: jest.fn(),
  listDirectoryQuietly: jest.fn(),
}));

const mockedListDirectory = listDirectoryQuietly as jest.Mock;
const mockedDeleteFile = deleteFileQuietly as jest.Mock;

describe('sweepOrphanPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('удаляет файл, отсутствующий среди known URIs', () => {
    mockedListDirectory.mockReturnValue(['orphan.jpg']);

    sweepOrphanPhotos([]);

    expect(mockedDeleteFile).toHaveBeenCalledWith('file:///mock-document/photos/orphan.jpg');
  });

  it('не удаляет файл, чьё имя есть среди known URIs', () => {
    mockedListDirectory.mockReturnValue(['keep.jpg']);

    sweepOrphanPhotos(['file:///mock-document/photos/keep.jpg']);

    expect(mockedDeleteFile).not.toHaveBeenCalled();
  });

  it('mock://-URI сидовых данных не мешают sweep (не совпадают ни с одним файлом)', () => {
    mockedListDirectory.mockReturnValue(['orphan.jpg']);

    sweepOrphanPhotos(['mock://order-1-photo.jpg']);

    expect(mockedDeleteFile).toHaveBeenCalledWith('file:///mock-document/photos/orphan.jpg');
  });

  it('пустой каталог — no-op', () => {
    mockedListDirectory.mockReturnValue([]);

    sweepOrphanPhotos(['file:///mock-document/photos/keep.jpg']);

    expect(mockedDeleteFile).not.toHaveBeenCalled();
  });
});
