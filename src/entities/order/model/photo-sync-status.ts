// Статус синхронизации фото (PDR client-sync §5, T-11 двухфазный фото-синк). Enum-стиль —
// const-object + производный тип, не `enum`. Значения совпадают с колонкой `sync_status` БД
// (см. миграцию v3): 'local' — фото ещё не отправлено, 'staged' — загружено (фаза 1), но
// мутация photo_add ещё не подтверждена сервером, 'committed' — подтверждено (фаза 2, Phase 14).
export const PhotoSyncStatusEnum = {
  Local: 'local',
  Staged: 'staged',
  Committed: 'committed',
} as const;

export type PhotoSyncStatusEnum = (typeof PhotoSyncStatusEnum)[keyof typeof PhotoSyncStatusEnum];

// Type guard для значения sync_status, прочитанного из внешнего источника (строка колонки БД).
export const isPhotoSyncStatus = (value: string): value is PhotoSyncStatusEnum =>
  (Object.values(PhotoSyncStatusEnum) as string[]).includes(value);
