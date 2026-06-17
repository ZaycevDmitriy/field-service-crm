import { ServiceOrderStatusEnum } from './order-status';
import type { IServiceOrder } from './types';

// Статичные mock-заявки для Phase 2 (UI на mock-данных). В Phase 3 переедут в
// `entities/order/api/orderMockService`. Ровно 6 заявок: 2 New / 3 InProgress / 1 Done / 0 Cancelled —
// совпадает со статичными счётчиками дашборда и фильтра «Все(6)/Новые(2)/В работе(3)/Готово(1)/Отменено(—)».
// MOCK_SERVICE_ORDERS[0] — ближайшая заявка (hero дашборда).
export const MOCK_SERVICE_ORDERS: IServiceOrder[] = [
  {
    id: 'order-1',
    status: ServiceOrderStatusEnum.New,
    title: 'Установка роутера',
    client: 'Иван Петров',
    address: 'ул. Ленина, 24',
    description:
      'Установить и настроить Wi-Fi роутер у абонента. Проверить уровень сигнала в комнатах, выдать памятку по доступу к сети.',
    scheduledTime: '09:00',
    scheduledSlot: '12:00 — 13:00',
    distanceLabel: '4.2 км',
    photos: [],
  },
  {
    id: 'order-2',
    status: ServiceOrderStatusEnum.InProgress,
    title: 'Замена маршрутизатора',
    client: 'Ольга Соколова',
    address: 'пр. Мира, 108, кв. 45',
    description:
      'Демонтировать вышедший из строя маршрутизатор, установить новый. Перенести настройки сети и проверить стабильность подключения.',
    scheduledTime: '10:30',
    scheduledSlot: '10:30 — 11:30',
    distanceLabel: '6.8 км',
    photos: [
      {
        id: 'photo-2-1',
        uri: 'mock://order-2/1',
        comment: 'Старый маршрутизатор',
        createdAt: '2026-05-04T10:35:00',
      },
      {
        id: 'photo-2-2',
        uri: 'mock://order-2/2',
        comment: 'Монтаж нового устройства',
        createdAt: '2026-05-04T10:52:00',
      },
      { id: 'photo-2-3', uri: 'mock://order-2/3', createdAt: '2026-05-04T11:05:00' },
    ],
  },
  {
    id: 'order-3',
    status: ServiceOrderStatusEnum.InProgress,
    title: 'Настройка IPTV',
    client: 'Сергей Кузнецов',
    address: 'ул. Гагарина, 5, кв. 12',
    description:
      'Подключить и настроить IPTV-приставку. Проверить воспроизведение каналов, обновить прошивку при необходимости.',
    scheduledTime: '11:15',
    scheduledSlot: '11:00 — 12:00',
    distanceLabel: '2.1 км',
    photos: [],
  },
  {
    id: 'order-4',
    status: ServiceOrderStatusEnum.InProgress,
    title: 'Диагностика линии',
    client: 'Марина Волкова',
    address: 'ул. Чехова, 31',
    description:
      'Найти причину обрывов связи на абонентской линии. Замерить параметры, при необходимости заменить участок кабеля.',
    scheduledTime: '13:00',
    scheduledSlot: '13:00 — 14:00',
    distanceLabel: '8.5 км',
    photos: [],
  },
  {
    id: 'order-5',
    status: ServiceOrderStatusEnum.New,
    title: 'Подключение интернета',
    client: 'Дмитрий Орлов',
    address: 'ул. Садовая, 17, кв. 88',
    description:
      'Завести оптический кабель в квартиру, установить ONT, настроить подключение по договору. Провести инструктаж абонента.',
    scheduledTime: '15:30',
    scheduledSlot: '15:00 — 16:00',
    distanceLabel: '11.0 км',
    photos: [],
  },
  {
    id: 'order-6',
    status: ServiceOrderStatusEnum.Done,
    title: 'Ремонт кабеля',
    client: 'Анна Морозова',
    address: 'ул. Полевая, 3',
    description:
      'Восстановить повреждённый участок кабеля в подъезде, восстановить связь у абонентов стояка. Зафиксировать результат фотоотчётом.',
    scheduledTime: '08:15',
    scheduledSlot: '08:00 — 09:00',
    distanceLabel: '3.4 км',
    photos: [
      {
        id: 'photo-6-1',
        uri: 'mock://order-6/1',
        comment: 'Повреждённый участок',
        createdAt: '2026-05-04T08:20:00',
      },
      {
        id: 'photo-6-2',
        uri: 'mock://order-6/2',
        comment: 'После ремонта',
        createdAt: '2026-05-04T08:50:00',
      },
    ],
  },
];
