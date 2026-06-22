// Публичный API слайса features/app-updates — только хук диагностики и действий обновления.
// Сервис updateService и enum статусов остаются внутренними (нативный expo-updates не утекает наружу).
export { useAppUpdates } from './model/useAppUpdates';
export type { IUpdateDiagnostics, IUseAppUpdates } from './model/useAppUpdates';
