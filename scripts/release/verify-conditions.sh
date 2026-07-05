#!/usr/bin/env bash
#
# verifyConditions-шаг релиза (вызывается из exec.verifyConditionsCmd в .releaserc.json, ПЕРВЫМ
# среди exec-плагинов — ДО версии/тега/Release/fingerprint.txt, т.е. до всех необратимых шагов).
#
# H4 (аудит 2026-07-02): без этой проверки сбой доставки (publishCmd) обнаруживался ПОСЛЕ тега,
# GitHub Release и fingerprint.txt — re-run semantic-release молча пропускал релиз (main уже ушёл
# вперёд), а следующий релиз сверял fingerprint с релизом без залитого APK и мог опубликовать OTA
# под runtimeVersion, которого нет ни у одного установленного билда. Здесь мы валим релиз РАНЬШЕ,
# если авторизация, нужная доставке (APK или OTA — маршрут решится позже, в prepare), заведомо
# недоступна: и `gh`, и `eas` нужны безусловно (build-android.sh скачивает предыдущий fingerprint
# через `gh release download` даже на OTA-ветви, а маршрут OTA/APK ещё не известен на этом шаге).
#
# L18 (аудит 2026-07-02): маршрут OTA/APK решается позже (в prepare), но первый релиз после этого
# батча ВСЕГДА уйдёт на APK (fingerprint изменён плагином подписи) — секреты release-keystore нужны
# безусловно, падаем здесь же, до тега/Release, а не посреди assembleRelease.
#
# Verbose-трассировка через echo — лог виден в Actions UI рядом с остальными release-скриптами.

set -euo pipefail

echo "[verify-conditions] START: проверяю авторизацию gh/eas и секреты release-подписи перед необратимыми шагами релиза."

echo "[verify-conditions] gh auth status…"
if ! gh auth status; then
  echo "::error::[verify-conditions] gh не авторизован (GH_TOKEN/GITHUB_TOKEN) — доставка (APK/fingerprint) недоступна."
  exit 1
fi

echo "[verify-conditions] eas whoami…"
if ! eas whoami; then
  echo "::error::[verify-conditions] eas не авторизован (EXPO_TOKEN) — OTA-доставка недоступна."
  exit 1
fi

echo "[verify-conditions] проверяю непустоту секретов release-keystore…"
for VAR_NAME in ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  if [ -z "${!VAR_NAME:-}" ]; then
    echo "::error::[verify-conditions] секрет ${VAR_NAME} пуст или не задан — release-подпись APK недоступна."
    exit 1
  fi
done

echo "[verify-conditions] проверяю валидность base64 в ANDROID_KEYSTORE_BASE64…"
if ! echo "${ANDROID_KEYSTORE_BASE64}" | base64 -d > /dev/null 2>&1; then
  echo "::error::[verify-conditions] ANDROID_KEYSTORE_BASE64 не является валидным base64."
  exit 1
fi

echo "[verify-conditions] DONE: gh и eas авторизованы, секреты release-keystore заданы и валидны."
