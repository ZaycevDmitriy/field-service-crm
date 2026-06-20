// Публичный API слайса order-reminder — постановка локального напоминания по заявке.
// Наружу отдаём только кнопку; оркестрация (promptOrderReminder, пресеты) — деталь реализации фичи.
export { OrderReminderButton, type IOrderReminderButtonProps } from './ui/order-reminder-button';
