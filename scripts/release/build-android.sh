#!/usr/bin/env bash
#
# Сборка release-APK для semantic-release (вызывается из exec.prepareCmd в .releaserc.json).
# Версия передаётся первым аргументом (`${nextRelease.version}`); versionCode = номер CI-прогона.
#
# Путь A: нативный Gradle на раннере GitHub, без EAS-кредитов и секретов. Подпись — debug.keystore
# из шаблона prebuild (signingConfigs.debug), поэтому секреты не нужны, а подпись стабильна.
#
# Verbose-трассировка через echo на каждом шаге — лог сборки читается в Actions UI.

set -euo pipefail

VERSION="${1:?usage: build-android.sh <version>}"

# Проводка значений в app.config.ts (читает эти env с дефолтами). versionCode — монотонный номер прогона.
export ONSITE_VERSION="${VERSION}"
export ONSITE_VERSION_CODE="${GITHUB_RUN_NUMBER:-1}"
export ONSITE_UPDATE_CHANNEL="${ONSITE_UPDATE_CHANNEL:-production}"

echo "[build-android] START version=${ONSITE_VERSION} versionCode=${ONSITE_VERSION_CODE} channel=${ONSITE_UPDATE_CHANNEL}"

mkdir -p dist

# 1. runtimeVersion (fingerprint) на ЧИСТОМ дереве, ДО prebuild. Значение зашьётся в APK; его же читает
#    OTA-воркфлоу как guard совместимости. fingerprint.config.js делает hash независимым от версии/канала,
#    поэтому APK и `eas update` получают одинаковый runtimeVersion.
echo "[build-android] fingerprint:generate (чистое дерево, до prebuild)…"
npx expo-updates fingerprint:generate --platform android 2>/dev/null \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).hash))" \
  > "dist/onsite-v${VERSION}.fingerprint.txt"
echo "[build-android] runtimeVersion=$(cat "dist/onsite-v${VERSION}.fingerprint.txt")"

# 2. CNG: каталог android/ в .gitignore → генерируем нативный проект; env из шага выше уходят в app.config.ts.
echo "[build-android] expo prebuild (android)…"
npx expo prebuild --platform android --no-install

chmod +x android/gradlew

# 3. KSP (:expo-updates:kspReleaseKotlin) исчерпывает дефолтный Metaspace шаблона prebuild на раннере →
#    OutOfMemoryError: Metaspace. Поднимаем лимиты Gradle- и Kotlin-демонов (дубль ключа → берётся последний).
echo "[build-android] поднимаем память Gradle/Kotlin (KSP Metaspace)…"
{
  echo ""
  echo "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8"
  echo "kotlin.daemon.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m"
} >> android/gradle.properties

# 4. Release-APK.
echo "[build-android] assembleRelease…"
(cd android && ./gradlew assembleRelease)

# 5. Раскладка артефактов для @semantic-release/github (единый префикс onsite-v<версия>).
echo "[build-android] копируем APK в dist…"
cp android/app/build/outputs/apk/release/app-release.apk "dist/onsite-v${VERSION}.apk"

echo "[build-android] DONE: dist/onsite-v${VERSION}.apk + dist/onsite-v${VERSION}.fingerprint.txt"
