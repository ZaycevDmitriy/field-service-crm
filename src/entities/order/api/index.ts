// Внутренний barrel сегмента api. Наружу (публичный API слайса) сервисы не выносятся —
// это деталь реализации; потребитель — только стор слайса.
export { orderMockService } from './orderMockService';
export { orderDatabaseService } from './orderDatabaseService';
