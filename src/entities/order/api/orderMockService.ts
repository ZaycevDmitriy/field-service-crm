import { MOCK_SERVICE_ORDERS } from '../model/mock';
import type { IServiceOrder } from '../model/types';

// Имитация задержки загрузки (мс) — приближает поведение к реальному источнику (SQLite — Phase 4).
const LOAD_DELAY_MS = 300;

// Глубокая копия заявки: новый объект + новый массив photos с копиями элементов.
// Нужна, чтобы иммутабельные переходы статусов в сторе не мутировали константу-mock.
const cloneOrder = (order: IServiceOrder): IServiceOrder => ({
  ...order,
  photos: order.photos.map((photo) => ({ ...photo })),
});

// Mock-сервис заявок — деталь реализации слайса (наружу через публичный API не выносится).
// Роль: источник данных для стора в Phase 3 (в Phase 4 заменяется на orderDatabaseService).
export const orderMockService = {
  // Возвращает глубокую копию mock-заявок после имитации асинхронной загрузки.
  async getOrders(): Promise<IServiceOrder[]> {
    try {
      await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));

      return MOCK_SERVICE_ORDERS.map(cloneOrder);
    } catch (error) {
      console.error('[orderMockService.getOrders] Не удалось получить заявки.', error);
      throw error;
    }
  },
};
