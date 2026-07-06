import { ServiceOrderStatusEnum } from './order-status';
import type { IServiceOrder } from './types';

// Шаблоны работ: заголовок + описание идут парой (описание раскрывает заголовок).
interface IMockOrderTemplate {
  title: string;
  description: string;
}

const ORDER_TEMPLATES: IMockOrderTemplate[] = [
  {
    title: 'Установка роутера',
    description:
      'Установить и настроить Wi-Fi роутер у абонента. Проверить уровень сигнала в комнатах, выдать памятку по доступу к сети.',
  },
  {
    title: 'Замена маршрутизатора',
    description:
      'Демонтировать вышедший из строя маршрутизатор, установить новый. Перенести настройки сети и проверить стабильность подключения.',
  },
  {
    title: 'Настройка IPTV',
    description:
      'Подключить и настроить IPTV-приставку. Проверить воспроизведение каналов, обновить прошивку при необходимости.',
  },
  {
    title: 'Диагностика линии',
    description:
      'Найти причину обрывов связи на абонентской линии. Замерить параметры, при необходимости заменить участок кабеля.',
  },
  {
    title: 'Подключение интернета',
    description:
      'Завести оптический кабель в квартиру, установить ONT, настроить подключение по договору. Провести инструктаж абонента.',
  },
  {
    title: 'Ремонт кабеля',
    description:
      'Восстановить повреждённый участок кабеля в подъезде, восстановить связь у абонентов стояка. Зафиксировать результат фотоотчётом.',
  },
];

// Адрес и координаты идут неразрывной парой: реальные дома Москвы, координаты верифицированы
// геокодером OSM и согласованы с подписью адреса (точка маршрута в Яндекс.Картах совпадает
// с карточкой). Точки разнесены по районам, чтобы геодистанция и сортировка getNearestOrder
// давали разный порядок.
interface IMockLocation {
  address: string;
  latitude: number;
  longitude: number;
}

// ВАЖНО: порядок первых 6 локаций менять нельзя — backfill миграции v1→v2
// (migrateOrdersSchema) сопоставляет координаты legacy-строкам order-1..6 по id, и адреса
// в старых БД должны получить именно свои координаты.
const LOCATIONS: IMockLocation[] = [
  { address: 'ул. Тверская, 15', latitude: 55.76233, longitude: 37.60797 },
  { address: 'Ленинградский пр-т, 36, кв. 45', latitude: 55.78818, longitude: 37.56687 },
  { address: 'ул. Профсоюзная, 64, кв. 12', latitude: 55.66643, longitude: 37.54759 },
  { address: 'Кутузовский пр-т, 26', latitude: 55.74392, longitude: 37.5438 },
  { address: 'Ленинский пр-т, 32, кв. 88', latitude: 55.7095, longitude: 37.58063 },
  { address: 'шоссе Энтузиастов, 24', latitude: 55.74785, longitude: 37.69789 },
];

const CLIENTS: string[] = [
  'Иван Петров',
  'Ольга Соколова',
  'Сергей Кузнецов',
  'Марина Волкова',
  'Дмитрий Орлов',
  'Анна Морозова',
  'Павел Лебедев',
  'Екатерина Фролова',
  'Алексей Громов',
  'Наталья Зайцева',
];

const MOCK_ORDERS_COUNT = 200;

// Начало рабочего дня и число 5-минутных шагов в окне 08:00–19:55.
const WORK_DAY_START_MINUTES = 8 * 60;
const TIME_STEPS = 144;
// Множитель, взаимно простой с TIME_STEPS: индексы пробегают все 144 слота без повторов подряд.
const TIME_STEP_MULTIPLIER = 37;

const toTimeLabel = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
};

// Детерминированная сборка заявки по индексу: без Math.random, чтобы сид (и завязанные на него
// тесты) был воспроизводимым. Пулы разной длины (6/10/6 со сдвигом) дают разные сочетания
// «работа × клиент × адрес» без ощущения копипасты.
const makeMockOrder = (index: number): IServiceOrder => {
  const template = ORDER_TEMPLATES[index % ORDER_TEMPLATES.length];
  // Сдвиг на floor(index/6) расцепляет пары «шаблон↔локация» (пулы одинаковой длины иначе
  // всегда шли бы синхронно); при index 0..5 сдвиг нулевой — order-1..6 получают свои
  // legacy-локации (см. комментарий LOCATIONS).
  const location =
    LOCATIONS[(index + Math.floor(index / ORDER_TEMPLATES.length)) % LOCATIONS.length];
  const client = CLIENTS[index % CLIENTS.length];

  const startMinutes = WORK_DAY_START_MINUTES + ((index * TIME_STEP_MULTIPLIER) % TIME_STEPS) * 5;
  const slotStartHour = Math.floor(startMinutes / 60);

  return {
    id: `order-${index + 1}`,
    status: ServiceOrderStatusEnum.New,
    title: template.title,
    client,
    address: location.address,
    description: template.description,
    scheduledTime: toTimeLabel(startMinutes),
    scheduledSlot: `${toTimeLabel(slotStartHour * 60)} — ${toTimeLabel((slotStartHour + 1) * 60)}`,
    latitude: location.latitude,
    longitude: location.longitude,
    photos: [],
  };
};

// Mock-заявки — источник сида локальной SQLite-БД (`entities/order/api/orderDatabaseService`
// наполняет ими БД при первом старте). 200 заявок, все в статусе New и без фото: объём для
// проверки списка/поиска/фильтра на реалистичной выборке; фотоотчёт и переходы статуса
// нарабатываются руками из UI. Без доступной локации «ближайшая» = самая ранняя по времени,
// с локацией — ближайшая по геодистанции (координаты циклически из 6 верифицированных точек).
export const MOCK_SERVICE_ORDERS: IServiceOrder[] = Array.from(
  { length: MOCK_ORDERS_COUNT },
  (_, index) => makeMockOrder(index),
);
