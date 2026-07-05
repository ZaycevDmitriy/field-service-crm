#!/usr/bin/env bash
#
# Prepare-шаг релиза (вызывается из exec.prepareCmd в .releaserc.json) с маршрутизацией доставки.
# Версия передаётся первым аргументом (`${nextRelease.version}`); versionCode считается из версии
# (см. M14 ниже).
#
# Решение OTA↔APK принимается ЗДЕСЬ по сравнению fingerprint текущего дерева с последним релизом:
#   - нет предыдущего fingerprint (первый релиз)        → APK (OTA некуда доехать);
#   - fingerprint совпал (нативный слой не менялся)      → OTA (без сборки APK);
#   - fingerprint изменился (нативный слой поменялся)    → APK.
# Результат пишется в dist/.delivery (читает publish-delivery.sh на шаге publish, ПОСЛЕ github-релиза).
# fingerprint.txt генерится ВСЕГДА и прикладывается к любому релизу — иначе guard следующего релиза
# не найдёт «последний» отпечаток.
#
# Путь A: нативный Gradle на раннере GitHub, без EAS-кредитов. Подпись (L18, аудит 2026-07-02) —
# собственный release-keystore из GitHub Secrets (plugins/with-release-signing.js инжектит
# signingConfigs.release в build.gradle); при отсутствии секретов Gradle-сниппет сам фоллбэкается
# на debug.keystore — локальный `expo run:android` работает без секретов.
#
# Verbose-трассировка через echo на каждом шаге — лог сборки читается в Actions UI.

set -euo pipefail

VERSION="${1:?usage: build-android.sh <version>}"

# Проводка значений в app.config.ts (читает эти env с дефолтами).
# versionCode (M14, аудит 2026-07-02): раньше был GITHUB_RUN_NUMBER — монотонный только пока прогонов
# больше, чем версий, и не привязан к семверу вообще (произвольный номер CI-прогона). Теперь считается
# из версии: major*10000 + minor*100 + patch (ограничение: patch/minor < 100 — semantic-release с
# текущим темпом релизов этого не превысит). Разовый переход: новый код (напр. 1.2.2 → 10202) на
# порядки больше исторических GITHUB_RUN_NUMBER (workflow Release: единицы прогонов), поэтому
# INSTALL_FAILED_VERSION_DOWNGRADE от перехода не грозит — offset-константа не нужна.
IFS='.' read -r VERSION_MAJOR VERSION_MINOR VERSION_PATCH <<< "${VERSION}"
ONSITE_VERSION_CODE=$((VERSION_MAJOR * 10000 + VERSION_MINOR * 100 + VERSION_PATCH))

export ONSITE_VERSION="${VERSION}"
export ONSITE_VERSION_CODE
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
#    создания нового тега/релиза, поэтому `gh release view/download` без тега берёт ПРЕДЫДУЩИЙ релиз.
# M13 (аудит 2026-07-02): раньше `gh release download … || true` глушил ЛЮБУЮ ошибку — «релиза ещё
# нет» (легитимно для самого первого релиза) неотличимо от сетевого сбоя/сбоя авторизации (тогда PREV
# молча становится "", и скрипт ошибочно решает, что это первый релиз → DELIVERY=apk). Явно разделяем:
# `gh release view` без загрузки ассетов — дешёвая проверка, что релиз вообще существует.
echo "[build-android] fetch fingerprint последнего релиза…"
rm -rf prev-fp
PREV_TAG=""
VIEW_ERROR_FILE="$(mktemp)"
# Один сетевой вызов: stdout (tagName) — в переменную, stderr — в файл для разбора причины сбоя.
if PREV_TAG="$(gh release view --json tagName --jq '.tagName' --repo "${GITHUB_REPOSITORY:-}" 2>"${VIEW_ERROR_FILE}")"; then
  mkdir -p prev-fp
  # Релиз существует, но fingerprint-ассета может не быть (повреждённый/ручной релиз) — это не
  # повод ронять релиз целиком: маршрутизируем на APK (PREV пуст), а не exit 1.
  gh release download --pattern '*.fingerprint.txt' --dir prev-fp --repo "${GITHUB_REPOSITORY:-}" || true
  PREV="$(cat prev-fp/*.fingerprint.txt 2>/dev/null || true)"
  if [ -z "${PREV}" ]; then
    echo "[build-android] у релиза ${PREV_TAG} нет fingerprint-ассета → фоллбэк на APK."
  fi
elif VIEW_ERROR="$(cat "${VIEW_ERROR_FILE}")" && echo "${VIEW_ERROR}" | grep -qi 'release not found'; then
  echo "[build-android] release not found → это первый релиз репозитория."
  PREV=""
else
  echo "::error::[build-android] gh release view упал не из-за отсутствия релиза: ${VIEW_ERROR}"
  exit 1
fi
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

# 3.1 APK-guard (H4, аудит 2026-07-02): fingerprint совпал → маршрут OTA, но если у релиза-источника
#     этого fingerprint (PREV) по факту НЕТ залитого APK-ассета (прошлая доставка сорвалась после
#     необратимых шагов — тег/Release/fingerprint.txt уже созданы, а publishCmd упал), то ни у одного
#     установленного билда нет этого runtimeVersion — OTA под него публиковать некуда. Разворачиваем
#     маршрут на APK, чтобы у fingerprint появился хотя бы один реальный носитель.
if [ "${DELIVERY}" = "ota" ]; then
  echo "[build-android] APK-guard: проверяю наличие APK-ассета у релиза-источника fingerprint…"
  # PREV_TAG уже получен в шаге 2 (DELIVERY=ota возможен только когда релиз найден, т.е. PREV_TAG непуст).
  if gh release view --json assets --jq '.assets[].name' --repo "${GITHUB_REPOSITORY:-}" 2>/dev/null \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.exit(d.split('\n').some((n)=>n.endsWith('.apk'))?0:1))"; then
    echo "[build-android] APK-ассет у релиза-источника (${PREV_TAG:-<неизвестен>}) найден → OTA остаётся."
  else
    DELIVERY="apk"
    echo "${DELIVERY}" > dist/.delivery
    echo "::warning::[build-android] APK-guard: у релиза-источника fingerprint (${PREV_TAG:-<неизвестен>}) нет APK-ассета (прошлая доставка сорвалась?) → DELIVERY=apk."
  fi
fi

# 4. OTA-ветвь: APK не собираем. eas update вычислит тот же runtimeVersion на чистом дереве.
if [ "${DELIVERY}" = "ota" ]; then
  echo "[build-android] DONE (OTA): сборка APK пропущена; ${FINGERPRINT_FILE} приложится к релизу."
  exit 0
fi

# 5. APK-ветвь: CNG (android/ в .gitignore) → генерируем нативный проект; env из шага выше уходят в app.config.ts.
#    EXPO_UPDATES_FINGERPRINT_OVERRIDE: Gradle-задача createUpdatesResources пересчитывает fingerprint
#    ВО ВРЕМЯ сборки, когда дерево уже загрязнено артефактами composite build (см. .fingerprintignore),
#    и зашивает результат в APK (assets/fingerprint). Override заставляет её зашить РОВНО значение
#    из шага 1 — runtimeVersion APK гарантированно совпадает с fingerprint.txt и будущими `eas update`.
export EXPO_UPDATES_FINGERPRINT_OVERRIDE="${CURRENT}"

echo "[build-android] expo prebuild (android)…"
npx expo prebuild --platform android --no-install

chmod +x android/gradlew

# 6. Release-keystore (L18, аудит 2026-07-02): decode СТРОГО ПОСЛЕ prebuild — он пересоздаёт
#    android/ и стёр бы файл, будь он положен раньше. plugins/with-release-signing.js уже инжектил
#    в build.gradle константный сниппет, который сам подхватит этот файл по имени. Без секрета
#    (verify-conditions гарантирует его непустоту в CI, но локально/в форках секретов нет) —
#    пропускаем: Gradle-сниппет фоллбэкается на debug.keystore.
if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
  echo "[build-android] decode release.keystore из ANDROID_KEYSTORE_BASE64…"
  echo "${ANDROID_KEYSTORE_BASE64}" | base64 -d > android/app/release.keystore
else
  echo "[build-android] ANDROID_KEYSTORE_BASE64 не задан → сборка уйдёт на debug-подпись шаблона."
fi

# 7. KSP (:expo-updates:kspReleaseKotlin) исчерпывает дефолтный Metaspace шаблона prebuild на раннере →
#    OutOfMemoryError: Metaspace. Поднимаем лимиты Gradle- и Kotlin-демонов (дубль ключа → берётся последний).
echo "[build-android] поднимаем память Gradle/Kotlin (KSP Metaspace)…"
{
  echo ""
  echo "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8"
  echo "kotlin.daemon.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m"
} >> android/gradle.properties

# 8. Release-APK.
echo "[build-android] assembleRelease…"
(cd android && ./gradlew assembleRelease)

# 9. Раскладка артефактов (единый префикс onsite-v<версия>). Заливку APK в Release делает publish-delivery.sh.
echo "[build-android] копируем APK в dist…"
cp android/app/build/outputs/apk/release/app-release.apk "dist/onsite-v${VERSION}.apk"

echo "[build-android] DONE (APK): dist/onsite-v${VERSION}.apk + ${FINGERPRINT_FILE}"
