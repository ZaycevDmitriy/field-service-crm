// Публичный API сегмента shared/lib/notifications — локальные напоминания по заявке.
// В отличие от location (прячет сервис за хуком), здесь наружу отдаём функции сервиса напрямую:
// оркестрация (разрешение, выбор пресета, отказ) живёт выше — в features/order-reminder.
// ⚠️ barrel @/shared/lib отсутствует — импортировать строго через @/shared/lib/notifications.
export {
  configureNotifications,
  mapPermissionStatus,
  PermissionResultEnum,
  requestPermission,
  scheduleOrderReminder,
  type IReminderContent,
} from './notificationService';
