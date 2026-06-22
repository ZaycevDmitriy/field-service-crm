# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## EAS Build и EAS Update

Доставка приложения разделена на два контура: **native (EAS Build)** — бинарь с нативным кодом, и **JS/asset (EAS Update)** — OTA-обновление поверх уже установленного бинаря.

> Команды `eas` требуют Expo-аккаунта (`eas login`) и устанавливаются глобально: `npm i -g eas-cli`.

### Development build

`expo-dev-client` даёт кастомный dev-клиент (замена Expo Go: поддерживает нативные модули проекта — камера, SQLite, геолокация, уведомления, `expo-updates`). Сборка и запуск:

```bash
eas build --profile development --platform android
npx expo start --dev-client
```

Установить полученный `.apk` на устройство/эмулятор, затем подключиться к Metro из dev-клиента.

### EAS Build (профили)

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

Перед первой сборкой связать проект с EAS и сконфигурировать обновления (заполняет `extra.eas.projectId` и `updates.url` в [`app.config.ts`](app.config.ts)):

```bash
eas init
eas update:configure
```

### EAS Update (OTA-демо)

Опубликовать JS/asset-обновление в канал — оно доедет до сборок с тем же `runtimeVersion`:

```bash
eas update --channel preview --message "Правка текста на экране настроек"
```

На устройстве экран **Настройки → Обновление** показывает channel/runtime и кнопки «Проверить обновления» / «Перезагрузить приложение»: «Проверить» скачивает доступное обновление, «Перезагрузить» применяет его. В режиме разработки OTA отключены — экран показывает «Недоступно в dev» и не падает.

### Граница native vs JS

| Что меняли | Как доставляется |
|------------|------------------|
| Нативный код и пакеты (`expo-camera`, `expo-updates`, разрешения, иконки/сплеш, версия SDK) | Новый **EAS Build** (OTA не поможет) |
| Только JS/TS и ассеты (логика, UI, тексты, изображения) | **EAS Update** (OTA) |

`runtimeVersion` в [`app.config.ts`](app.config.ts) задан политикой `fingerprint`: Expo вычисляет отпечаток нативного слоя (`@expo/fingerprint`) и помечает им и сборку, и обновление. Обновление с несовместимым отпечатком (изменился native-слой) не применится к старому бинарю — это и есть автоматическая граница native-vs-JS.

## Documentation

| Guide | Description |
|-------|-------------|
| [PDR](docs/PDR.md) | Полная спецификация проекта (источник истины) |
| [Планы по фазам](docs/plans/README.md) | Пошаговые планы реализации (Phase 1–9) |
| [Orders Logic (Phase 3)](docs/orders-logic.md) | Стор заявок, поиск, фильтры, переходы статусов |
| [SQLite Persistence (Phase 4)](docs/sqlite-persistence.md) | Локальное хранилище заявок и фото в SQLite |
| [Location & Maps (Phase 6)](docs/location-maps.md) | Геолокация, дистанция до заявки, маршрут во внешних картах |

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
