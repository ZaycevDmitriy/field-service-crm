#!/usr/bin/env bash
#
# Prepare-шаг релиза (вызывается из exec.prepareCmd в .releaserc.json) с маршрутизацией доставки.
# Версия передаётся первым аргументом (`${nextRelease.version}`); versionCode = номер CI-прогона.
#
# Решение OTA↔APK принимается ЗДЕСЬ по сравнению fingerprint текущего дерева с последним релизом:
#   - нет предыдущего fingerprint (первый релиз)        → APK (OTA некуда доехать);
#   - fingerprint совпал (нативный слой не менялся)      → OTA (без сборки APK);
#   - fingerprint изменился (нативный слой поменялся)    → APK.
# Результат пишется в dist/.delivery (читает publish-delivery.sh на шаге publish, ПОСЛЕ github-релиза).
# fingerprint.txt генерится ВСЕГДА и прикладывается к любому релизу — иначе guard следующего релиза
# не найдёт «последний» отпечаток.
#
# Путь A: нативный Gradle на раннере GitHub, без EAS-кредитов. Подпись — debug.keystore из шаблона
# prebuild (signingConfigs.debug), секреты не нужны, подпись стабильна.
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

FINGERPRINT_FILE="dist/onsite-v${VERSION}.fingerprint.txt"

# 1. runtimeVersion (fingerprint) на ЧИСТОМ дереве, ДО prebuild. fingerprint.config.js делает hash
#    независимым от версии/канала, поэтому APK и `eas update` получают одинаковый runtimeVersion.
echo "[build-android] fingerprint:generate (чистое дерево, до prebuild)…"
npx expo-updates fingerprint:generate --platform android 2>/dev/null \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).hash))" \
  > "${FINGERPRINT_FILE}"
CURRENT="$(cat "${FINGERPRINT_FILE}")"
echo "[build-android] runtimeVersion (current)=${CURRENT}"

# 2. Fingerprint последнего релиза (ассет onsite-v<версия>.fingerprint.txt). prepare выполняется ДО
#    создания нового тега/релиза, поэтому `gh release download` без тега берёт ПРЕДЫДУЩИЙ релиз.
echo "[build-android] fetch fingerprint последнего релиза…"
rm -rf prev-fp
gh release download --pattern '*.fingerprint.txt' --dir prev-fp --repo "${GITHUB_REPOSITORY:-}" || true
PREV="$(cat prev-fp/*.fingerprint.txt 2>/dev/null || true)"
echo "[build-android] runtimeVersion (последний релиз)=${PREV:-<нет>}"

# 3. Маршрутизация доставки.
if [ -z "${PREV}" ]; then
  DELIVERY="apk"
  echo "[build-android] нет предыдущего fingerprint → первый релиз → DELIVERY=apk"
elif [ "${CURRENT}" = "${PREV}" ]; then
  DELIVERY="ota"
  echo "[build-android] fingerprint совпал → нативка не менялась → DELIVERY=ota"
else
  DELIVERY="apk"
  echo "[build-android] fingerprint изменился (${CURRENT} != ${PREV}) → нативка поменялась → DELIVERY=apk"
fi
echo "${DELIVERY}" > dist/.delivery

# 4. OTA-ветвь: APK не собираем. eas update вычислит тот же runtimeVersion на чистом дереве.
if [ "${DELIVERY}" = "ota" ]; then
  echo "[build-android] DONE (OTA): сборка APK пропущена; ${FINGERPRINT_FILE} приложится к релизу."
  exit 0
fi

# 5. APK-ветвь: CNG (android/ в .gitignore) → генерируем нативный проект; env из шага выше уходят в app.config.ts.
echo "[build-android] expo prebuild (android)…"
npx expo prebuild --platform android --no-install

chmod +x android/gradlew

# 6. KSP (:expo-updates:kspReleaseKotlin) исчерпывает дефолтный Metaspace шаблона prebuild на раннере →
#    OutOfMemoryError: Metaspace. Поднимаем лимиты Gradle- и Kotlin-демонов (дубль ключа → берётся последний).
echo "[build-android] поднимаем память Gradle/Kotlin (KSP Metaspace)…"
{
  echo ""
  echo "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8"
  echo "kotlin.daemon.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m"
} >> android/gradle.properties

# 7. Release-APK.
echo "[build-android] assembleRelease…"
(cd android && ./gradlew assembleRelease)

# 8. Раскладка артефактов (единый префикс onsite-v<версия>). Заливку APK в Release делает publish-delivery.sh.
echo "[build-android] копируем APK в dist…"
cp android/app/build/outputs/apk/release/app-release.apk "dist/onsite-v${VERSION}.apk"

echo "[build-android] DONE (APK): dist/onsite-v${VERSION}.apk + ${FINGERPRINT_FILE}"
