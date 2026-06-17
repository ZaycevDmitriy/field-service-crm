import type { ServiceOrderStatusEnum } from './order-status';

// Фото — часть агрегата заявки (отдельной entity нет). Реальный захват — Phase 5.
export interface IServiceOrderPhoto {
  id: string;
  // URI снимка. В Phase 2 — mock-плейсхолдер, реальный локальный URI появится в Phase 5.
  uri: string;
  comment?: string;
  // ISO-метка создания.
  createdAt: string;
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
  // Статичная подпись дистанции, напр. «4.2 км» (реальная геодистанция — Phase 6).
  distanceLabel: string;
  photos: IServiceOrderPhoto[];
}
