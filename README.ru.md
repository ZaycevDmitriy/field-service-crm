# Onsite

[![CI](https://github.com/ZaycevDmitriy/field-service-crm/actions/workflows/ci.yml/badge.svg)](https://github.com/ZaycevDmitriy/field-service-crm/actions/workflows/ci.yml)

[English](README.md) · **Русский**

Onsite — мобильное mini-CRM для выездных сервисных работников (установка роутеров, диагностика
линий, ремонт кабеля). Это портфолио-проект на Expo и React Native с акцентом на offline-first,
нативные API устройства и чистую feature-ориентированную архитектуру.

## Обзор

Работник открывает приложение и сразу видит ближайшую активную заявку, проходит по списку заявок
(поиск, фильтр по статусу), открывает заявку и ведёт её по статусам (Новая → В работе →
Готово / Отменена), прикладывает фотоотчёт, строит маршрут во внешних картах и ставит напоминания о
визите. Все данные хранятся локально в SQLite, поэтому приложение работает без сети. Доставка
приложения разделена на два контура: **нативный** (EAS Build) и **JS/asset** (EAS Update OTA).

## Что демонстрирует проект

- Файловую навигацию Expo Router
- Expo Development Build
- Профили EAS Build
- OTA-флоу EAS Update
- Локальную персистентность в SQLite
- Нативные разрешения
- Камеру и флоу фотоотчёта
- Геолокацию и внешние карты
- Локальные уведомления
- Feature-ориентированную архитектуру
- Переиспользуемые UI-компоненты React Native
- Светлую и тёмную темы по системной схеме
- Состояния загрузки, пустого списка, ошибки и offline

## Демо

Хостинг-демо нет — запускайте приложение локально на development build (см.
[Быстрый старт](#быстрый-старт)). Скриншоты ниже сняты на iOS-симуляторе.

Живое OTA-демо: **Настройки → Обновление** показывает channel / runtime version и действия
«Проверить обновления» / «Перезагрузить»; опубликуйте `eas update` и наблюдайте, как оно доедет до
уже установленной сборки (см. [Демо EAS Update](#демо-eas-update)).

## Скриншоты

> iOS-симулятор, выставлена московская локация для гео-функций. Светлая и тёмная темы следуют
> системной схеме.

| Экран | Светлая | Тёмная |
|-------|---------|--------|
| Дашборд | ![Дашборд, светлая](screenshots/dashboard-light.png) | ![Дашборд, тёмная](screenshots/dashboard-dark.png) |
| Заявки | ![Заявки, светлая](screenshots/orders-light.png) | ![Заявки, тёмная](screenshots/orders-dark.png) |
| Детали заявки | ![Детали, светлая](screenshots/order-details-light.png) | ![Детали, тёмная](screenshots/order-details-dark.png) |
| Настройки | ![Настройки, светлая](screenshots/settings-light.png) | ![Настройки, тёмная](screenshots/settings-dark.png) |

Флоу фотоотчёта — запрос разрешения камеры с фолбэком на галерею. Экран съёмки намеренно тёмный в
обеих темах:

<img src="screenshots/photo-flow.png" alt="Флоу фотоотчёта" width="300" />

## Возможности

- **Дашборд** — приветствие, сводка за сегодня (новые / в работе / готово) и ближайшая активная
  заявка по дистанции по прямой.
- **Список заявок** — виртуализированный список (FlashList) с регистронезависимым поиском по клиенту
  или адресу и чипами-фильтрами по статусу.
- **Детали заявки** — переходы статусов (Новая → В работе → Готово / Отменена), клиент, адрес,
  временной слот и описание.
- **Фотоотчёт** — прикрепление фото к заявке с камеры или из галереи за экраном разрешения.
- **Геолокация и маршрут** — дистанция по прямой до каждой заявки; «Открыть маршрут» передаёт
  управление системному приложению карт.
- **Напоминания** — локальное уведомление к времени визита.
- **Offline-first** — заявки и фото хранятся в SQLite; обрабатываются offline-баннер и состояния
  ошибки / пустого списка.
- **OTA-обновления** — EAS Update с runtime version по политике fingerprint.
- **Темизация** — светлая и тёмная темы по системной схеме.

## Стек

- **Рантайм:** Expo SDK 56, React Native 0.85, React 19 (Hermes, New Architecture)
- **Язык:** TypeScript 6 (`strict`, без `any`)
- **Навигация:** Expo Router (typed routes, React Compiler)
- **Состояние:** Zustand (только долгоживущее состояние)
- **Персистентность:** expo-sqlite
- **Нативные API:** expo-camera, expo-image-picker, expo-location, expo-notifications, expo-updates
- **UI / анимации:** собственный UI-kit, react-native-reanimated, @shopify/flash-list,
  @react-native-vector-icons/material-icons
- **Тулинг:** ESLint 9 (+ SonarJS), Prettier, jest-expo (unit-тесты)

## Архитектура

Feature-Sliced Design (FSD-lite) поверх Expo Router. Импорты строго вниз:

```
app → pages → features → entities → shared
```

- **app** — тонкие route-файлы Expo Router плюс корневой layout (провайдеры, инициализация БД,
  статус-бар).
- **pages** — слайс на экран; композирует features и entities.
- **features** — пользовательские действия: `order-search`, `order-filter`, `order-status`,
  `photo-capture`, `order-reminder`, `open-route`, `app-updates`.
- **entities** — бизнес-сущность `order` (`model` / `api` / `ui`). Фото — часть агрегата заявки, не
  отдельная entity.
- **shared** — project-agnostic UI-kit, токены темы и библиотеки (`date`, `geo`, `location`,
  `notifications`, `db`, `invariant`).

Правила: слайс импортирует только из слоёв строго ниже; слайсы одного слоя не импортируют друг друга;
слайс используется только через публичный API (`index.ts`). Нативные API и персистентность живут в
сервисах (`entities/*/api`, `shared/lib`); UI и стор не дёргают их напрямую. Долгоживущее состояние —
в Zustand; временное состояние экрана — local state.

## Структура проекта

```
src/
  app/                  # Маршруты Expo Router (тонкие) + корневой layout
    (tabs)/             #   дашборд, заявки, настройки
    orders/[orderId]    #   детали заявки
    camera/[orderId]    #   съёмка фото
  pages/                # dashboard, orders, order-details, photo, settings
  features/             # order-search, order-filter, order-status, photo-capture,
                        # order-reminder, open-route, app-updates
  entities/
    order/              # model (типы, стор, getNearestOrder), api, ui
  shared/
    config/theme        # токены цвета / отступов / радиусов / типографики
    ui/                 # business-agnostic UI-kit
    lib/                # date, geo, location, notifications, db, invariant
    model/              # app-wide стор (offline, локация, проверки обновлений)
```

## Быстрый старт

Требования: Node 20+, npm, Xcode (iOS-симулятор) или Android Studio (эмулятор) и **development
build** приложения. Проект использует нативные модули, поэтому Expo Go не поддерживается — см.
[Development build](#development-build).

```bash
npm install        # установка зависимостей
npm start          # запуск Metro для dev-клиента (expo start --dev-client)
npm run ios        # открыть на iOS-симуляторе
npm run android    # открыть на Android-эмуляторе
```

Проверки качества:

```bash
npm run check      # lint + typecheck + format:check
npm test           # unit-тесты (jest-expo)
```

## Development build

`expo-dev-client` даёт кастомный dev-клиент (замена Expo Go: поддерживает нативные модули проекта —
камера, SQLite, геолокация, уведомления, `expo-updates`). Сборка и запуск:

```bash
eas build --profile development --platform android
npm start
```

Установить полученный `.apk` на устройство/эмулятор, затем подключиться к Metro из dev-клиента.

> Команды `eas` требуют Expo-аккаунта (`eas login`) и устанавливаются глобально: `npm i -g eas-cli`.

## EAS Build

Профили заданы в [`eas.json`](eas.json):

| Профиль | Назначение | Distribution | Channel |
|---------|-----------|--------------|---------|
| `development` | dev-клиент с Metro | internal | development |
| `preview` | internal-демо без Metro (release JS) | internal | preview |
| `production` | стора-сборка, autoIncrement версии | store | production |

```bash
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile production --platform android
```

iOS-сборки опциональны (нужен Apple Developer Account) — добавить `--platform ios`.

Перед первой сборкой связать проект с EAS и сконфигурировать обновления (заполняет
`extra.eas.projectId` и `updates.url` в [`app.config.ts`](app.config.ts)):

```bash
eas init
eas update:configure
```

## Демо EAS Update

Опубликовать JS/asset-обновление в канал — оно доедет до сборок с тем же `runtimeVersion`:

```bash
eas update --channel preview --message "Правка текста на экране настроек"
```

На устройстве экран **Настройки → Обновление** показывает channel/runtime и кнопки «Проверить
обновления» / «Перезагрузить приложение»: «Проверить» скачивает доступное обновление, «Перезагрузить»
применяет его. В режиме разработки OTA отключены — экран показывает «Недоступно в dev» и не падает.

**Граница native vs JS:**

| Что меняли | Как доставляется |
|------------|------------------|
| Нативный код и пакеты (`expo-camera`, `expo-updates`, разрешения, иконки/сплеш, версия SDK) | Новый **EAS Build** (OTA не поможет) |
| Только JS/TS и ассеты (логика, UI, тексты, изображения) | **EAS Update** (OTA) |

`runtimeVersion` в [`app.config.ts`](app.config.ts) задан политикой `fingerprint`: Expo вычисляет
отпечаток нативного слоя (`@expo/fingerprint`) и помечает им и сборку, и обновление. Обновление с
несовместимым отпечатком (изменился native-слой) не применится к старому бинарю — это и есть
автоматическая граница native-vs-JS.

## Источник дизайна

UI реализован по дизайн-прототипу (экраны, отступы и цветовые токены). Прототип лежит в `design/` и
держится вне репозитория — это reference-материал, а не исходники приложения. Отклонения от прототипа
задокументированы в PDR проекта.

## Дизайн-решения

- **FSD-lite вместо плоской структуры** — явное владение и однонаправленные импорты держат фичи
  изолированными и тестируемыми.
- **Zustand только для долгоживущего состояния** — заявки и app-wide флаги в сторах; временное
  состояние экрана — local state.
- **Собственный UI-kit вместо библиотеки компонентов** — демонстрирует основы UI React Native и
  держит зависимости минимальными.
- **Тема по системе** — светлая / тёмная следуют схеме ОС; ручного тумблера в MVP нет.
- **FlashList v2 для списка заявок** — виртуализация больших списков; `maintainVisibleContentPosition`
  отключается при полной подмене data на фильтре / поиске, чтобы список не «задирался».
- **Runtime version по fingerprint** — EAS Update доедет только до сборок с совместимым нативным
  отпечатком, что автоматически обеспечивает границу native-vs-JS.

## Компромиссы

- Без бэкенда в MVP: SQLite выбран, чтобы сфокусироваться на offline-first поведении и нативных API
  Expo.
- Без аутентификации: проект про рабочий флоу выездного сервиса, а не про управление аккаунтами.
- Без полноэкранной карты: для MVP достаточно внешних карт, это сокращает скоуп.
- Без UI-библиотеки: собственные компоненты демонстрируют основы UI React Native.
- Тема: светлая и тёмная реализованы и следуют схеме ОС; ручной in-app переключатель
  (светлая / тёмная / системная) намеренно оставлен на будущее.
- Без отдельного Android-UI: реализация на React Native использует общий UI с платформенными
  правками только там, где это необходимо.
- Только локальные уведомления: push требует бэкенда и credentials, поэтому это будущий скоуп.

## Дальнейшие улучшения

Задокументированы, но намеренно не реализованы в MVP:

- Бэкенд с аутентификацией и синхронизацией между устройствами
- Push-уведомления (требуют бэкенда и credentials)
- Полноэкранная карта в приложении
- Ручной in-app переключатель темы (светлая / тёмная / системная)
- CI (GitHub Actions) с прогоном lint, typecheck и тестов

## Лицензия

[MIT](LICENSE) © 2026 Dmitriy Zaycev
