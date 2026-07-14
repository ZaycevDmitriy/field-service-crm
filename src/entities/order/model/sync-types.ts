// Типы серверного pull-контракта (PDR client-sync §5, T-07; бэкенд FR-08,
// onsite-backend/src/modules/sync/schemas.ts). Внутренние типы синка — деталь слайса, наружу
// (entities/order/index.ts) не экспортируются.

// Метаданные фото в pull-элементе заявки — в контракте ЕСТЬ (FR-08), но в Phase 12 сознательно
// игнорируются: фото остаются write-path клиента до двухфазного фото-синка (Phase 14). Тип оставлен
// для полноты контракта (зеркалит onsite-backend syncPhotoSchema); маппер (см. pull-item-to-order.ts)
// это поле не читает.
export interface IPullOrderPhotoItem {
  id: string;
  orderId: string;
  authorId: string;
  status: string;
  comment: string | null;
  takenAt: string;
  createdAt: string;
}

// Полезная нагрузка заявки в pull-элементе (onsite-backend syncOrderPayloadSchema). `status` —
// нетипизированная строка: внешние данные (сеть) валидируются на границе (см. pullItemToOrder),
// типу канала не доверяем.
export interface IPullOrderPayload {
  id: string;
  status: string;
  title: string;
  client: string;
  address: string;
  description: string;
  scheduledAt: string;
  slotStart: string;
  slotEnd: string;
  latitude: number | null;
  longitude: number | null;
  assignedTo: string | null;
  updatedSeq: number;
  createdAt: string;
  updatedAt: string;
  photos: IPullOrderPhotoItem[];
}

export interface IPullOrderItem {
  type: 'order';
  seq: number;
  order: IPullOrderPayload;
}

// Tombstone переназначения (PDR client-sync §5, бэкенд §5.5): заявка снята с текущего пользователя —
// применяется удалением локальной заявки с фото и outbox-записями (см. applyPullPage).
export interface IPullUnassignedItem {
  type: 'unassigned';
  seq: number;
  orderId: string;
}

export type IPullItem = IPullOrderItem | IPullUnassignedItem;

export const isPullUnassignedItem = (item: IPullItem): item is IPullUnassignedItem =>
  item.type === 'unassigned';

// Ответ GET /v1/sync/orders?cursor&limit — без hasMore: признак продолжения — полная страница
// (items.length === limit).
export interface IPullOrdersResponse {
  items: IPullItem[];
  nextCursor: number;
}
