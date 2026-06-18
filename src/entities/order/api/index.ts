// Внутренний barrel сегмента api. Наружу (публичный API слайса) сервис не выносится —
// это деталь реализации; потребитель — только стор слайса.
export { orderDatabaseService } from './orderDatabaseService';
