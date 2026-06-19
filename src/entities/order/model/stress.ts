import { ServiceOrderStatusEnum } from './order-status';
import type { IServiceOrder } from './types';

// Dev-only флаг стресс-теста виртуализации списка заявок. При `true` стор наполняется синтетикой
// мимо SQLite (см. `useOrdersStore.initialize`). ВНИМАНИЕ: перед коммитом/релизом держать `false`
// (план #9 — вернуть в выключенное состояние).
export const STRESS_TEST = false;

// Сколько синтетических заявок генерировать при включённом стресс-тесте (диапазон проверки — 500–1000).
export const STRESS_TEST_COUNT = 1000;

// Циклическая раздача статусов — распределение остаётся реалистичным, счётчики фильтра не вырождаются.
const STRESS_STATUSES = [
  ServiceOrderStatusEnum.New,
  ServiceOrderStatusEnum.InProgress,
  ServiceOrderStatusEnum.InProgress,
  ServiceOrderStatusEnum.Done,
  ServiceOrderStatusEnum.Cancelled,
] as const;

// Детерминированный генератор синтетических заявок для стресс-теста (dev-only, в БД не попадает).
// Стабильные уникальные id (`stress-${i}`) — корректный keyExtractor и рециклинг FlashList.
export function makeStressOrders(count: number): IServiceOrder[] {
  const orders: IServiceOrder[] = [];

  for (let i = 0; i < count; i += 1) {
    const status = STRESS_STATUSES[i % STRESS_STATUSES.length];
    const hour = String(8 + (i % 12)).padStart(2, '0');
    const minute = String((i * 7) % 60).padStart(2, '0');

    orders.push({
      id: `stress-${i}`,
      status,
      title: `Стресс-заявка №${i + 1}`,
      client: `Клиент ${i + 1}`,
      address: `ул. Тестовая, ${i + 1}`,
      description: 'Синтетическая заявка для стресс-теста виртуализации списка.',
      scheduledTime: `${hour}:${minute}`,
      scheduledSlot: `${hour}:00 — ${hour}:59`,
      // Синтетические координаты в районе Москвы — детерминированный разброс по индексу.
      latitude: 55.75 + (i % 100) / 1000,
      longitude: 37.62 + (i % 100) / 1000,
      photos: [],
    });
  }

  return orders;
}
