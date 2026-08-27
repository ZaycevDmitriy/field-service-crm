// Типы серверного pull/push-контракта (PDR client-sync §5/§8, T-07/T-08…T-10; бэкенд FR-08,
// onsite-backend/src/modules/sync/schemas.ts). Внутренние типы синка — деталь слайса, наружу
// (entities/order/index.ts) не экспортируются.

import type { ServiceOrderStatusEnum } from './order-status';

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

// Типы push-контракта (PDR client-sync §8, T-08…T-10; бэкенд POST /v1/sync/mutations, сверено с
// onsite-backend/openapi.json 2026-07-22). В этой фазе — только смена статуса; `photo_add` — Phase 14.
export const SyncMutationTypeEnum = {
  StatusChange: 'status_change',
} as const;
export type SyncMutationTypeEnum = (typeof SyncMutationTypeEnum)[keyof typeof SyncMutationTypeEnum];

// Плоская форма мутации на проводе (без payload/occurredAt — все поля верхнего уровня).
export interface IStatusChangeMutation {
  mutationId: string;
  type: SyncMutationTypeEnum;
  orderId: string;
  to: ServiceOrderStatusEnum;
  baseStatus: ServiceOrderStatusEnum;
}

// Тело POST /v1/sync/mutations: minItems 1 / maxItems 500 (валидируется на стороне вызывающего —
// пустой батч отправлять нельзя, 422).
export interface IPushMutationsRequest {
  mutations: IStatusChangeMutation[];
}

export const MutationVerdictEnum = {
  Applied: 'applied',
  Duplicate: 'duplicate',
  Conflict: 'conflict',
  Rejected: 'rejected',
} as const;
export type MutationVerdictEnum = (typeof MutationVerdictEnum)[keyof typeof MutationVerdictEnum];

// Снимок заявки в конфликтном вердикте — в точности IPullOrderPayload без photos (пуш-контракт
// снимок фото не несёт). pullItemToOrder принимает этот же Omit-тип (см. pull-item-to-order.ts).
export type IConflictOrderSnapshot = Omit<IPullOrderPayload, 'photos'>;

// `result` — нетипизированная строка (внешние данные, граница валидируется на потребителе через
// MutationVerdictEnum, как status в pull-контракте).
export interface IMutationVerdict {
  mutationId: string;
  result: string;
  order?: IConflictOrderSnapshot;
}

export interface IPushMutationsResponse {
  verdicts: IMutationVerdict[];
}

// Строка sync_outbox (T2/Phase 13, snake_case — зеркалит DDL order-database-service.ts).
export interface IOutboxMutationRow {
  mutation_id: string;
  type: string;
  order_id: string;
  payload_json: string;
  occurred_at: string;
  state: string;
  attempts: number;
}

// Доменная мутация очереди (payload_json уже распарсен и провалидирован мапером БД-сервиса).
// occurredAt — только для локального порядка выгрузки, на сервер не уходит (не входит в
// IStatusChangeMutation, отправляемую в теле запроса).
export type IOutboxMutation = IStatusChangeMutation & { occurredAt: string };
