# Changelog

## 1.0.0 (2026-06-24)

### Features

* **app:** достроить табы заявки/настройки и иконки IconSymbol ([fe4fe92](https://github.com/ZaycevDmitriy/field-service-crm/commit/fe4fe92a4435a2d5b3a008fd5370cad895d83e44))
* **ci:** quality-workflow (lint/typecheck/format/test) + .nvmrc ([7179eb9](https://github.com/ZaycevDmitriy/field-service-crm/commit/7179eb9a55c9d240f147b33f2b0bebffcd17e00b))
* **ci:** релиз Android APK по тегу v* (Путь A, сборка на раннере) ([ac6e31f](https://github.com/ZaycevDmitriy/field-service-crm/commit/ac6e31f3d7d6aa7cc896b0f3d2c51bcd6e9cb172))
* **dashboard:** динамическая дата и приветствие по времени суток ([dc8434a](https://github.com/ZaycevDmitriy/field-service-crm/commit/dc8434a170178df97e67a2830ae84028119f3714))
* **entities,features:** UI заявки, поиск/фильтр, превью фото ([9f72c63](https://github.com/ZaycevDmitriy/field-service-crm/commit/9f72c63f55e9332062b7dc7ca6f4032adf536200))
* **entities:** доменная модель order, enums, labels, mock ([7e154a1](https://github.com/ZaycevDmitriy/field-service-crm/commit/7e154a1f6d40c0fa6af2d8a9bdac06f4ba43e1a2))
* **location:** инфраструктура geo/location + expo-location ([762d518](https://github.com/ZaycevDmitriy/field-service-crm/commit/762d518da02c2799621fa4573876e9de225fb8ea))
* **notifications:** expo-notifications + notificationService (shared/lib) ([70a8119](https://github.com/ZaycevDmitriy/field-service-crm/commit/70a81199504910832ce7aacc06485464dada28a0))
* **order-reminder:** слайс напоминания (model + кнопка) ([c14e020](https://github.com/ZaycevDmitriy/field-service-crm/commit/c14e0207c77c6756cac645dd417e173c06ba96ff))
* **orders:** addOrderPhoto + shared/lib/id + относительное хранение URI фото ([f0fa566](https://github.com/ZaycevDmitriy/field-service-crm/commit/f0fa566fb860aab7f375fc5f80ba0d2f2416f310))
* **orders:** database-сервис — схема, сид, запросы (SQLite) ([90d3776](https://github.com/ZaycevDmitriy/field-service-crm/commit/90d3776f95d433430b85b6bc2fbb551a8d5cb669))
* **orders:** инициализация БД при старте и очистка из Settings ([5287de6](https://github.com/ZaycevDmitriy/field-service-crm/commit/5287de6d1420066c454ecaff7a151a88f3d88269))
* **orders:** кнопка «Напомнить» в деталях + init уведомлений в app ([ad19853](https://github.com/ZaycevDmitriy/field-service-crm/commit/ad198531b0e16b8f317d8ac069814e7307e69778))
* **orders:** логика заявок на Zustand — поиск, фильтры, статусы (Phase 3) ([55deaac](https://github.com/ZaycevDmitriy/field-service-crm/commit/55deaacd4ee624db49e13d1d51d74c6dab2d215b))
* **orders:** стор на SQLite — гидрация, персист статуса, очистка ([9f68000](https://github.com/ZaycevDmitriy/field-service-crm/commit/9f680008ae5f04a78397a97fa2057279fa633e94))
* **order:** гео-дистанция, миграция БД и маршрут в Яндекс.Картах ([ae79916](https://github.com/ZaycevDmitriy/field-service-crm/commit/ae799166ef21b4aaa85cf43197b4374cd0ae307f))
* **pages:** детали заявки, фото-флоу, диагностика настроек ([111a12d](https://github.com/ZaycevDmitriy/field-service-crm/commit/111a12dc9e4eeb31c77d89bb8801d23921993d41))
* **pages:** добавить заглушки dashboard/orders/settings и тонкие route-файлы ([9cf6d96](https://github.com/ZaycevDmitriy/field-service-crm/commit/9cf6d9618a06a8cc5e214f074f7d109386bf8f37))
* **pages:** экраны dashboard и orders со состояниями ([784c288](https://github.com/ZaycevDmitriy/field-service-crm/commit/784c288e9dd4c7fdb216a71c154d2f8eadddbdac)), closes [10/#11](https://github.com/10/field-service-crm/issues/11)
* **phase8:** живая EAS-диагностика на экране настроек ([f14ab9a](https://github.com/ZaycevDmitriy/field-service-crm/commit/f14ab9a93f7b9850ecaedd37ca7ffadd38473087))
* **phase8:** слайс app-updates + форматтер shared/lib/date ([169d216](https://github.com/ZaycevDmitriy/field-service-crm/commit/169d216eee819a09af6f87426b53f107e98b32ad))
* **photo:** камера CameraView (onCameraReady-гейтинг) + превью снимка + публичный API ([4e1ef6b](https://github.com/ZaycevDmitriy/field-service-crm/commit/4e1ef6bf0fa3a115b8cd0b2002bdc4fa797d99e5))
* **photo:** оркестрация Capture→Preview и привязка фото к заявке по orderId ([fdd1f8b](https://github.com/ZaycevDmitriy/field-service-crm/commit/fdd1f8b711a6fe592a4542520c7af9e206a7ac05))
* **photo:** сервисы камеры/галереи/файловой системы (photoService, photoPermissionService) ([2d70efd](https://github.com/ZaycevDmitriy/field-service-crm/commit/2d70efd3ffc1dc1239b399a619da807e473b5189))
* pin settings title above scrollable content ([88cb26e](https://github.com/ZaycevDmitriy/field-service-crm/commit/88cb26e40dadfdef94951a0edfcab99e15e2730d))
* **shared/ui:** generic-компоненты состояний, иконка-кнопка, поиск, диагностика ([f98b256](https://github.com/ZaycevDmitriy/field-service-crm/commit/f98b256326859a05f4ea6a74184e5acb20363e06))
* **shared:** добавить базовые UI-примитивы text/divider/card/screen ([441a8b0](https://github.com/ZaycevDmitriy/field-service-crm/commit/441a8b0abeee93883b8eb1b1835ac26f51ee7353))
* **shared:** добавить компоненты button/badge/chip/input/skeleton ([0a28a73](https://github.com/ZaycevDmitriy/field-service-crm/commit/0a28a73cecae1f1c5a0b954b235fb0c9d447eaa7))
* **shared:** добавить токены spacing/radius/typography/shadows ([45be9db](https://github.com/ZaycevDmitriy/field-service-crm/commit/45be9db4119f59c97bc2b1f54176ff98fb24414d))
* **shared:** добавить цветовые токены тёмной темы и хук useColors ([7f60a22](https://github.com/ZaycevDmitriy/field-service-crm/commit/7f60a22de6a11ee497c2b85e53326c74a0e64b2a))
* **shared:** добавить цветовые токены темы ([e8e91d7](https://github.com/ZaycevDmitriy/field-service-crm/commit/e8e91d70cef0ee410d4ad21592b90f2d8ebaf196))
* **shared:** расширение токенов тем, тинт-фоны, маппинг иконок IconSymbol ([b3bf029](https://github.com/ZaycevDmitriy/field-service-crm/commit/b3bf029ac08d536dee718663b5f246c5f63a7f1c))
* версионирование semantic-release (release-ветка) + CHANGELOG + проводка OTA ([#24](https://github.com/ZaycevDmitriy/field-service-crm/issues/24)) ([5206048](https://github.com/ZaycevDmitriy/field-service-crm/commit/52060489f4424bd1b566d04dc51dd0da52b8bf39))

### Bug Fixes

* **ci:** поднять Metaspace/heap Gradle+Kotlin (KSP OOM в release-android) ([22f6f18](https://github.com/ZaycevDmitriy/field-service-crm/commit/22f6f18dcb7253919128a70a059e99d2a88bcaf3))
* correct React Native Tools extension publisher id (typosquat) ([dbfcc2e](https://github.com/ZaycevDmitriy/field-service-crm/commit/dbfcc2e64421a2fbf9462a3b7ccf2b091111cd3b))
* **order-details:** динамический нижний отступ скролла по высоте CTA-бара ([1abc6a5](https://github.com/ZaycevDmitriy/field-service-crm/commit/1abc6a567e989982a920f6c49d08dda6f924f43a))
* **orders:** список не задирается вверх при переключении фильтра ([e12d537](https://github.com/ZaycevDmitriy/field-service-crm/commit/e12d53755651207e4cecd23b869c17388edb0439))
* **order:** реальные согласованные адреса Москвы в мок-данных ([0ae8f5e](https://github.com/ZaycevDmitriy/field-service-crm/commit/0ae8f5ef19777565dc32b3a07b91e938e81c8c9c))
* **phase8:** диагностика — '—' для пустого channel/profile, короткий runtime ([50c0d90](https://github.com/ZaycevDmitriy/field-service-crm/commit/50c0d90dda699d94f233db7266f054d71821dfb9))
* **photo:** закрепить CTA предпросмотра снизу, превью растягивается на доступную высоту ([9c7df2a](https://github.com/ZaycevDmitriy/field-service-crm/commit/9c7df2a8ff7601dd348f86bb65c1b8bdcad198a5))
* **photo:** убрать iOS-разрешение микрофона (microphonePermission:false) — фото-only ([af5b002](https://github.com/ZaycevDmitriy/field-service-crm/commit/af5b002a000455d42567f36492911cf88366f2ec))
* **settings:** локализовать заголовок секции «Обновление» ([af1e69a](https://github.com/ZaycevDmitriy/field-service-crm/commit/af1e69a57a5a49f2a2b2717d4366d9f65bb45aea))
* **ui:** a11y-роли тапабельным карточкам, не передавать mock-URI в expo-image ([b6fa07c](https://github.com/ZaycevDmitriy/field-service-crm/commit/b6fa07c184d2d5dd899071f763df8ea9d3e70625))
* **ui:** убрать пустую полосу под списком «Заявок» ([ba22470](https://github.com/ZaycevDmitriy/field-service-crm/commit/ba22470f4f3367540f8338a8be596ac9fd4152d2))

### Performance Improvements

* **order-filter:** memo + useMemo для счётчиков фильтра ([528ef9d](https://github.com/ZaycevDmitriy/field-service-crm/commit/528ef9dbbf50defe4edfd000523a897f911a3fbe))
* **orders:** виртуализация списка заявок (FlashList v2) + стабильная шапка + отзывчивый поиск ([575f818](https://github.com/ZaycevDmitriy/field-service-crm/commit/575f81884bbdf39a9b94b79d4115c3851642825d))
* **orders:** изолировать шапку от ввода в поиске ([e1026da](https://github.com/ZaycevDmitriy/field-service-crm/commit/e1026da60869ed9b9c92f378decad99c87bb1a0a))
* **ui:** мемоизировать variantColors в Badge ([5fd8e27](https://github.com/ZaycevDmitriy/field-service-crm/commit/5fd8e27701f4899bb3c1a688fd9ca6cfc4684583))

<!--
  Файл ведётся автоматически semantic-release (preset `conventionalcommits`) при релизе с ветки `release`.
  Записи добавляются ботом из Conventional Commits и следуют семантическому версионированию —
  не редактируйте их вручную. См. README → Releases.
-->
