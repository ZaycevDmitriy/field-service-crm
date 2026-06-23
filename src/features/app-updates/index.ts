// Публичный API слайса features/app-updates — хук диагностики/действий и презентационные бейдж/подсказка
// статуса. Сервис updateService и enum статусов остаются внутренними (нативный expo-updates не утекает наружу).
export { useAppUpdates } from './model/useAppUpdates';
export type { IUpdateDiagnostics, IUseAppUpdates } from './model/useAppUpdates';
export { UpdateStatusBadge } from './ui/update-status-badge';
export { UpdateStatusHint } from './ui/update-status-hint';
