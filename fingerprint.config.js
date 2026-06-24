// Конфиг @expo/fingerprint — управляет вычислением runtimeVersion (политика `fingerprint`).
// Авто-подхватывается из корня проекта и `expo-updates fingerprint:generate`, и сборкой/`eas update`.
//
// Зачем: при релизе по «Пути A» version/versionCode/канал OTA инжектятся из env (см. app.config.ts).
// Эмпирически подтверждено, что каждое из этих значений меняет hash fingerprint. Но это НЕ нативная
// совместимость — если их не исключить, runtimeVersion APK (версия релиза) и OTA-обновления (дефолтная
// версия) разойдутся после первого же бампа версии, и обновление не доедет до установленного билда.
// Поэтому исключаем версии и канал из отпечатка, оставляя его привязанным только к нативному слою.
//
// `PackageJsonAndroidAndIosScriptsIfNotContainRun` — дефолтный skip @expo/fingerprint; явный список
// sourceSkips переопределяет дефолт, поэтому возвращаем его сами (prebuild правит npm-скрипты
// android/ios → без него fingerprint до и после prebuild разный).

/** @type {import('expo/fingerprint').Config} */
const config = {
  sourceSkips: [
    'PackageJsonAndroidAndIosScriptsIfNotContainRun',
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
  ],
  fileHookTransform: (source, chunk, isEndOfFile, encoding) => {
    // Канал OTA (`updates.requestHeaders['expo-channel-name']`) зашивается в нативный билд, но не
    // относится к нативной совместимости — выкидываем его из сериализованного ExpoConfig перед хешем.
    if (source.type === 'contents' && source.id === 'expoConfig' && chunk != null) {
      const expoConfig = JSON.parse(typeof chunk === 'string' ? chunk : chunk.toString(encoding));
      if (expoConfig.updates) {
        delete expoConfig.updates.requestHeaders;
      }
      return JSON.stringify(expoConfig);
    }
    return chunk;
  },
};

module.exports = config;
