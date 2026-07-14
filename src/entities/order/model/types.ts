import type { ServiceOrderStatusEnum } from './order-status';
import type { PhotoSyncStatusEnum } from './photo-sync-status';

// Фото — часть агрегата заявки (отдельной entity нет). Реальный захват — Phase 5.
export interface IServiceOrderPhoto {
  id: string;
  // URI снимка — всегда локальный файл на устройстве (загруженный бинарник сервер связывает
  // по id, см. serverPhotoId).
  uri: string;
  comment?: string;
  // ISO-метка создания записи (вставки в локальную БД).
  createdAt: string;
  // Id фото на сервере — появляется после фазы 1 двухфазного синка (T-11, Phase 14).
  serverPhotoId?: string;
  // Статус синка фото (PDR client-sync §5). Новые фото создаются с Local (Phase 14).
  syncStatus: PhotoSyncStatusEnum;
  // ISO-метка фактической съёмки (EXIF/момент нажатия затвора), отдельно от createdAt —
  // обязательна для сервера при multipart-загрузке (T-11), пока не заполняется (Phase 14).
  takenAt?: string;
}

// Доменная модель заявки (PDR §10). Domain-тип, отделён от UI-моделей.
export interface IServiceOrder {
  id: string;
  status: ServiceOrderStatusEnum;
  title: string;
  client: string;
  address: string;
  description: string;
  // Короткое время визита для списка, напр. «09:00» (Phase 6 — производное от даты).
  scheduledTime: string;
  // Временной слот для деталей, напр. «12:00 — 13:00».
  scheduledSlot: string;
  // Гео-координаты адреса заявки (Phase 6). Persistent domain-поля. На сервере nullable
  // (Phase 11) — заявка без геокодированного адреса валидна; фильтрация/guard null — на
  // стороне entities/pages (getNearestOrder, useOrderDistanceLabel, маршрут), не в shared/lib/geo.
  // Дистанция до работника — производное от текущей локации (см. useOrderDistanceLabel), в
  // модели/БД не хранится.
  latitude: number | null;
  longitude: number | null;
  photos: IServiceOrderPhoto[];
  // Серверные поля синка (PDR client-sync §5, T-05/T-07/T-09) — optional до Phase 12 (заявки
  // остаются локальными, эти поля появятся после первого pull).
  // Курсор последней серверной записи заявки — основа last-write-wins merge при pull (Phase 12).
  updatedSeq?: number;
  // Id исполнителя (UUID пользователя сервера), которому назначена заявка.
  assignedTo?: string;
  // Канонические серверные дата/время визита (ISO 8601, timestamptz) — источник для
  // scheduledTime/scheduledSlot, которые остаются производными строками для рендера.
  scheduledAt?: string;
  slotStart?: string;
  slotEnd?: string;
  // ISO-метки создания/последнего изменения заявки на сервере.
  createdAt?: string;
  updatedAt?: string;
}
