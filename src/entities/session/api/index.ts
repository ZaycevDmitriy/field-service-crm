// Публичный API сегмента api слайса session. session-service — деталь реализации (как
// orderDatabaseService): наружу отдаём только эти тонкие функции, а не сервис целиком.
export { login, logout, restoreSession, refreshSession, getAccessToken } from './session-service';
