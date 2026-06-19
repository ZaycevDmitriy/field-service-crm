// Публичный API сегмента shared/lib/location — текущая локация работника.
// `locationService` (нативный expo-location) — деталь реализации, наружу не выносится: UI работает
// через хук.
export { useCurrentLocation, LocationStatusEnum } from './useCurrentLocation';
