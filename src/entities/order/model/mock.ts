import { ServiceOrderStatusEnum } from './order-status';
import type { IServiceOrder } from './types';

// Статичные mock-заявки — источник сида локальной SQLite-БД (`entities/order/api/orderDatabaseService`
// наполняет ими БД при первом старте). Ровно 6 заявок: 2 New / 3 InProgress / 1 Done / 0 Cancelled —
// исходные счётчики дашборда и фильтра «Все(6)/Новые(2)/В работе(3)/Готово(1)/Отменено(—)».
// Адреса — реальные дома Москвы (координаты верифицированы геокодером OSM и согласованы с подписью
// адреса, чтобы точка маршрута в Яндекс.Картах совпадала с карточкой). Точки разнесены по районам,
// чтобы геодистанция и сортировка getNearestOrder давали разный порядок. Без доступной локации
// «ближайшая» = самая ранняя по времени (09:00 — order-1), с локацией — ближайшая по геодистанции.
export const MOCK_SERVICE_ORDERS: IServiceOrder[] = [
  {
    id: 'order-1',
    status: ServiceOrderStatusEnum.New,
    title: 'Установка роутера',
    client: 'Иван Петров',
    address: 'ул. Тверская, 15',
    description:
      'Установить и настроить Wi-Fi роутер у абонента. Проверить уровень сигнала в комнатах, выдать памятку по доступу к сети.',
    scheduledTime: '09:00',
    scheduledSlot: '12:00 — 13:00',
    latitude: 55.76233,
    longitude: 37.60797,
    photos: [],
  },
  {
    id: 'order-2',
    status: ServiceOrderStatusEnum.InProgress,
    title: 'Замена маршрутизатора',
    client: 'Ольга Соколова',
    address: 'Ленинградский пр-т, 36, кв. 45',
    description:
      'Демонтировать вышедший из строя маршрутизатор, установить новый. Перенести настройки сети и проверить стабильность подключения.',
    scheduledTime: '10:30',
    scheduledSlot: '10:30 — 11:30',
    latitude: 55.78818,
    longitude: 37.56687,
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
    address: 'ул. Профсоюзная, 64, кв. 12',
    description:
      'Подключить и настроить IPTV-приставку. Проверить воспроизведение каналов, обновить прошивку при необходимости.',
    scheduledTime: '11:15',
    scheduledSlot: '11:00 — 12:00',
    latitude: 55.66643,
    longitude: 37.54759,
    photos: [],
  },
  {
    id: 'order-4',
    status: ServiceOrderStatusEnum.InProgress,
    title: 'Диагностика линии',
    client: 'Марина Волкова',
    address: 'Кутузовский пр-т, 26',
    description:
      'Найти причину обрывов связи на абонентской линии. Замерить параметры, при необходимости заменить участок кабеля.',
    scheduledTime: '13:00',
    scheduledSlot: '13:00 — 14:00',
    latitude: 55.74392,
    longitude: 37.5438,
    photos: [],
  },
  {
    id: 'order-5',
    status: ServiceOrderStatusEnum.New,
    title: 'Подключение интернета',
    client: 'Дмитрий Орлов',
    address: 'Ленинский пр-т, 32, кв. 88',
    description:
      'Завести оптический кабель в квартиру, установить ONT, настроить подключение по договору. Провести инструктаж абонента.',
    scheduledTime: '15:30',
    scheduledSlot: '15:00 — 16:00',
    latitude: 55.7095,
    longitude: 37.58063,
    photos: [],
  },
  {
    id: 'order-6',
    status: ServiceOrderStatusEnum.Done,
    title: 'Ремонт кабеля',
    client: 'Анна Морозова',
    address: 'шоссе Энтузиастов, 24',
    description:
      'Восстановить повреждённый участок кабеля в подъезде, восстановить связь у абонентов стояка. Зафиксировать результат фотоотчётом.',
    scheduledTime: '08:15',
    scheduledSlot: '08:00 — 09:00',
    latitude: 55.74785,
    longitude: 37.69789,
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
