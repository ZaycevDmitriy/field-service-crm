import * as ImagePicker from 'expo-image-picker';

import { requestMediaLibraryPermissionAsync } from '../photo-permission-service';
import { photoService, sweepOrphanPhotos } from '../photo-service';

import { deleteFileQuietly, listDirectoryQuietly } from '@/shared/lib/fs';

// Импорт модуля под тестом — после моков (иначе тянет реальный expo-file-system при инициализации).

// Управляемое из тестов поведение File.move (L8: успешный перенос / фоллбэк на copy).
const mockMove = jest.fn<Promise<void>, [{ uri: string }]>();

// Мок expo-file-system: MockFile отслеживает move/copy для проверки L8 (persistPhoto), остальное —
// как раньше, только строит Directory/File-пути (uri) для listDirectoryQuietly/deleteFileQuietly.
jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;
    exists = true;

    constructor(...args: [{ uri: string }, string]) {
      this.uri = `${args[0].uri}${args[1]}/`;
    }

    create = jest.fn();
  }

  class MockFile {
    uri: string;

    constructor(source: MockDirectory | string, name?: string) {
      this.uri = typeof source === 'string' ? source : `${source.uri}${name}`;
    }

    move(destination: { uri: string }): Promise<void> {
      return mockMove(destination).then(() => {
        this.uri = destination.uri;
      });
    }

    copy = jest.fn(() => Promise.resolve());
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

jest.mock('../photo-permission-service', () => ({
  requestMediaLibraryPermissionAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('@/shared/lib/id', () => ({
  createId: () => 'mock-id',
}));

const mockedListDirectory = listDirectoryQuietly as jest.Mock;
const mockedDeleteFile = deleteFileQuietly as jest.Mock;
const mockedRequestPermission = requestMediaLibraryPermissionAsync as jest.Mock;
const mockedLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

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

describe('pickPhotoFromLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('L6: при отказе в разрешении не открывает галерею и возвращает null', async () => {
    mockedRequestPermission.mockResolvedValue(false);

    const result = await photoService.pickPhotoFromLibrary();

    expect(result).toBeNull();
    expect(mockedLaunchLibrary).not.toHaveBeenCalled();
  });

  it('L12: при разрешении открывает галерею с quality 0.7 (как камера)', async () => {
    mockedRequestPermission.mockResolvedValue(true);
    mockedLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg' }],
    });

    const result = await photoService.pickPhotoFromLibrary();

    expect(result).toBe('file:///picked.jpg');
    expect(mockedLaunchLibrary).toHaveBeenCalledWith(expect.objectContaining({ quality: 0.7 }));
  });
});

describe('persistPhoto (L8)', () => {
  const TEMP_URI = 'file:///cache/temp.jpg';
  const PERSISTED_URI = 'file:///mock-document/photos/mock-id.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
    mockMove.mockResolvedValue(undefined);
  });

  it('переносит снимок через move и не удаляет исходник отдельно', async () => {
    const result = await photoService.persistPhoto(TEMP_URI);

    expect(result).toBe(PERSISTED_URI);
    expect(mockedDeleteFile).not.toHaveBeenCalled();
  });

  it('фоллбэк на copy + явное удаление исходника, если move недоступен', async () => {
    mockMove.mockRejectedValueOnce(new Error('cross-volume'));

    const result = await photoService.persistPhoto(TEMP_URI);

    expect(result).toBe(PERSISTED_URI);
    expect(mockedDeleteFile).toHaveBeenCalledWith(TEMP_URI);
  });
});
