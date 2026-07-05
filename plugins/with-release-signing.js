const { withAppBuildGradle } = require('expo/config-plugins');

// Config-плагин L18 (аудит 2026-07-02): без него release-APK подписывается общеизвестным
// debug.keystore шаблона prebuild — любой может собрать APK с той же подписью и Android
// поставит его поверх Onsite как «обновление».
//
// Плагин безусловный (не читает env на этапе конфигурации) — его вывод в build.gradle
// ДОЛЖЕН быть константным независимо от того, где считается fingerprint: локальная машина без
// секретов и CI с секретами обязаны получить одинаковый android/app/build.gradle, иначе
// runtimeVersion разойдётся (инцидент v1.2.0 «локальный hash ≠ CI», см. fingerprint.config.js).
// Выбор release vs debug подписи сделан константным Gradle-сниппетом — он читает
// System.getenv и наличие android/app/release.keystore В МОМЕНТ СБОРКИ, а не здесь.
//
// android/app/release.keystore раскладывается build-android.sh из ANDROID_KEYSTORE_BASE64
// СТРОГО после prebuild (иначе prebuild перезаписал бы android/ и удалил файл).

// Уникальный якорь — открывающая скобка контейнера signingConfigs шаблона prebuild.
const SIGNING_CONFIGS_ANCHOR = 'signingConfigs {\n        debug {';

// Родной release-сниппет: Gradle сам решает release/debug подпись в момент сборки.
const RELEASE_SIGNING_CONFIG = `signingConfigs {
        release {
            def releaseKeystoreFile = file('release.keystore')
            def hasReleaseKeystore = releaseKeystoreFile.exists() &&
                System.getenv('ANDROID_KEYSTORE_PASSWORD') != null &&
                System.getenv('ANDROID_KEY_ALIAS') != null &&
                System.getenv('ANDROID_KEY_PASSWORD') != null
            if (hasReleaseKeystore) {
                storeFile releaseKeystoreFile
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            } else {
                // Локальный expo run:android без секретов — фоллбэк на debug-подпись шаблона.
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
        debug {`;

// Уникальный якорь — строка подписи release build type шаблона prebuild (с комментарием-предупреждением).
const BUILD_TYPE_ANCHOR =
  '// Caution! In production, you need to generate your own keystore file.\n' +
  '            // see https://reactnative.dev/docs/signed-apk-android.\n' +
  '            signingConfig signingConfigs.debug';

const BUILD_TYPE_REPLACEMENT =
  '// Caution! In production, you need to generate your own keystore file.\n' +
  '            // see https://reactnative.dev/docs/signed-apk-android.\n' +
  '            signingConfig signingConfigs.release';

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (config) => {
    const { contents } = config.modResults;

    if (!contents.includes(SIGNING_CONFIGS_ANCHOR)) {
      throw new Error(
        '[with-release-signing] Не найден ожидаемый блок signingConfigs в android/app/build.gradle — ' +
          'шаблон prebuild изменился, сверить якорь плагина вручную.',
      );
    }
    if (!contents.includes(BUILD_TYPE_ANCHOR)) {
      throw new Error(
        '[with-release-signing] Не найдена ожидаемая строка signingConfig release build type в ' +
          'android/app/build.gradle — шаблон prebuild изменился, сверить якорь плагина вручную.',
      );
    }

    config.modResults.contents = contents
      .replace(SIGNING_CONFIGS_ANCHOR, RELEASE_SIGNING_CONFIG)
      .replace(BUILD_TYPE_ANCHOR, BUILD_TYPE_REPLACEMENT);

    return config;
  });

module.exports = withReleaseSigning;
