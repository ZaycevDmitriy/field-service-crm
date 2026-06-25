#!/usr/bin/env bash
#
# Publish-шаг релиза (вызывается из exec.publishCmd в .releaserc.json, ПОСЛЕ @semantic-release/github).
# Маркер dist/.delivery пишет build-android.sh на шаге prepare. Здесь — только исполнение доставки:
#   - apk → залить собранный APK в уже созданный GitHub Release (`gh release upload`);
#   - ota → опубликовать JS/asset-бандл в ветку production (`eas update`).
# Версия передаётся первым аргументом (`${nextRelease.version}`).
#
# fingerprint.txt уже приложен @semantic-release/github к релизу (для обеих ветвей) — здесь не трогаем.
#
# Env (выставляет release.yml): GH_TOKEN/GITHUB_TOKEN — для `gh`; EXPO_TOKEN — для `eas update`.

set -euo pipefail

VERSION="${1:?usage: publish-delivery.sh <version>}"

DELIVERY="$(cat dist/.delivery 2>/dev/null || true)"
echo "[publish-delivery] version=${VERSION} delivery=${DELIVERY:-<нет>}"

case "${DELIVERY}" in
  apk)
    APK="dist/onsite-v${VERSION}.apk"
    echo "[publish-delivery] APK → загрузка ${APK} в Release v${VERSION}…"
    gh release upload "v${VERSION}" "${APK}" --clobber --repo "${GITHUB_REPOSITORY:-}"
    echo "[publish-delivery] DONE: APK залит в Release v${VERSION}."
    ;;
  ota)
    # eas update бандлит JS из app.config.ts → версия берётся из ONSITE_VERSION (иначе дефолт 1.0.0).
    # --platform android: web-бандл (expo-sqlite wasm) для OTA не нужен и падает на публикации.
    # --non-interactive eas update не поддерживает (CI=true на раннере уже даёт неинтерактив).
    export ONSITE_VERSION="${VERSION}"
    echo "[publish-delivery] OTA → eas update --branch production --platform android (ONSITE_VERSION=${VERSION})…"
    eas update --branch production --platform android --message "Release v${VERSION} (OTA)"
    echo "[publish-delivery] DONE: OTA опубликован в ветку production."
    ;;
  *)
    echo "::error::[publish-delivery] неизвестный маркер доставки '${DELIVERY}' (ожидался apk|ota)."
    exit 1
    ;;
esac
