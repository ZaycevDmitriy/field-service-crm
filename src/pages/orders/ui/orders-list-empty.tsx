import { type FC, useCallback } from 'react';

import { OrdersSkeletonList } from './orders-skeleton-list';

import { useOrdersStore } from '@/entities/order';
import { EmptyState, ErrorState } from '@/shared/ui';

// Состояния списка для `ListEmptyComponent` FlashList (рендерится, когда `data` пуст). Стабильный
// store-subscribed компонент: FlashList всегда смонтирован, поэтому шапка видна во всех состояниях
// (решение F2 плана). Внутри нет TextInput — перемонтирование безопасно.
export const OrdersListEmpty: FC = () => {
  const loading = useOrdersStore((state) => state.loading);
  const error = useOrdersStore((state) => state.error);
  const ordersCount = useOrdersStore((state) => state.orders.length);
  const loadOrders = useOrdersStore((state) => state.loadOrders);

  // Стабильный по ссылке колбэк: компонент подписан на стор несколькими селекторами и ререндерится
  // при смене loading/error/orders; loadOrders — стабильный экшен Zustand.
  const handleRefresh = useCallback(() => {
    loadOrders();
  }, [loadOrders]);

  // Начальная загрузка (заявок ещё нет) — скелетоны. При pull-to-refresh `orders` непуст → список
  // остаётся, сюда не попадаем (без мигания скелетоном).
  if (loading) {
    return <OrdersSkeletonList />;
  }

  if (error) {
    return (
      <ErrorState
        title="Не удалось загрузить заявки"
        description="Проверьте подключение и попробуйте снова."
        actionLabel="Повторить"
        onRetry={handleRefresh}
      />
    );
  }

  // База пуста (нет ни одной заявки).
  if (ordersCount === 0) {
    return (
      <EmptyState
        icon="list.bullet"
        title="Заявок пока нет"
        description="Новые заявки появятся здесь."
        actionLabel="Обновить"
        actionIcon="arrow.clockwise"
        onAction={handleRefresh}
      />
    );
  }

  // Заявки есть, но фильтр/поиск ничего не оставил.
  return (
    <EmptyState
      icon="magnifyingglass"
      title="Ничего не найдено"
      description="Измените запрос или фильтр."
    />
  );
};
