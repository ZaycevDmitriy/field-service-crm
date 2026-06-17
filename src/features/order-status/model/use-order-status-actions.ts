import { useCallback } from 'react';

import { useOrdersStore } from '@/entities/order';

export interface IOrderStatusActions {
  startWork: () => void;
  completeWork: () => void;
  cancelOrder: () => void;
}

/**
 * Действия смены статуса для конкретной заявки. Оборачивает экшены `useOrdersStore`,
 * захватывая `orderId`, чтобы страница деталей не знала о структуре стора.
 */
export const useOrderStatusActions = (orderId: string): IOrderStatusActions => {
  // Селективная выборка экшенов — референсы функций стабильны между рендерами.
  const startWorkAction = useOrdersStore((state) => state.startWork);
  const completeWorkAction = useOrdersStore((state) => state.completeWork);
  const cancelOrderAction = useOrdersStore((state) => state.cancelOrder);

  const startWork = useCallback(() => startWorkAction(orderId), [startWorkAction, orderId]);
  const completeWork = useCallback(
    () => completeWorkAction(orderId),
    [completeWorkAction, orderId],
  );
  const cancelOrder = useCallback(() => cancelOrderAction(orderId), [cancelOrderAction, orderId]);

  return { startWork, completeWork, cancelOrder };
};
