import { type ConfigContext, type ExpoConfig } from 'expo/config';

// Динамический конфиг Expo (миграция с app.json, PDR §24). Файл вне `eslint src` — стиль держим вручную.
//
// Перед EAS-сборкой заполнить два значения через CLI (T3, требует Expo-аккаунта):
//   eas init               → печатает projectId  → вписать в `extra.eas.projectId`
//   eas update:configure   → печатает updates.url → вписать в `updates.url`
// Для динамического app.config.ts CLI не правит файл сам, значения вписываются вручную.
//
// `runtimeVersion: fingerprint` — автоматически вычисляет границу совместимости build↔update
// по нативному отпечатку (@expo/fingerprint): несовместимые OTA не доедут до старого билда.
// `extra.buildProfile` читает built-in env `EAS_BUILD_PROFILE` (доступен только в EAS Build,
// не при локальной оценке конфига) → локально undefined, экран настроек падает на авторитетный
// `Updates.channel` (см. features/app-updates).

// Проводка версии и канала OTA для релиза по «Пути A» (Gradle на раннере, без EAS Build).
// semantic-release в exec-шаге (`.releaserc.json`) выставляет эти env перед `expo prebuild`; локально
// и в EAS-сборках переменных нет → берутся дефолты и прежнее поведение (канал в EAS-сборках задаёт
// профиль в `eas.json`, поэтому `expo-channel-name` инжектится только когда переменная задана).
const appVersion = process.env.ONSITE_VERSION || '1.0.0';
const androidVersionCode = Number(process.env.ONSITE_VERSION_CODE) || 1;
const otaChannel = process.env.ONSITE_UPDATE_CHANNEL;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Onsite',
  slug: 'onsite',
  version: appVersion,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'onsite',
  userInterfaceStyle: 'automatic',
  runtimeVersion: {
    policy: 'fingerprint',
  },
  updates: {
    url: 'https://u.expo.dev/1af6a2a8-4892-4d9a-961a-1792ae2a8277',
    // Канал OTA зашивается в нативный билд «Пути A» (для EAS-сборок канал задаёт `eas.json`).
    ...(otaChannel ? { requestHeaders: { 'expo-channel-name': otaChannel } } : {}),
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.zaycevdi.onsite',
    infoPlist: {
      LSApplicationQueriesSchemes: ['yandexmaps'],
    },
  },
  android: {
    package: 'com.zaycevdi.onsite',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    versionCode: androidVersionCode,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
    'expo-font',
    'expo-image',
    'expo-status-bar',
    'expo-web-browser',
    '@react-native-vector-icons/material-icons',
    'expo-sqlite',
    [
      'expo-camera',
      {
        cameraPermission: 'Onsite использует камеру для фотоотчёта по заявке.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Onsite использует галерею для добавления фото к заявке.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Onsite использует геолокацию для расчёта дистанции до заявки и построения маршрута.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-notifications',
      {
        color: '#2563EB',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    // Имя build-профиля EAS (development/preview/production). Локально undefined → ключ опускается
    // при сериализации (Expo превращает null в {}, поэтому используем undefined, а не `?? null`).
    buildProfile: process.env.EAS_BUILD_PROFILE,
    eas: {
      projectId: '1af6a2a8-4892-4d9a-961a-1792ae2a8277',
    },
  },
});
