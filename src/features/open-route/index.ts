// Публичный API слайса open-route — открытие маршрута во внешних картах.
// Экспортирует обе сущности: функцию (для split-CTA дашборда) и кнопку (для инлайна в order-details).
export { openMapsRoute, type IRouteDestination } from './lib/openMapsRoute';
export { OpenRouteButton, type IOpenRouteButtonProps } from './ui/open-route-button';
