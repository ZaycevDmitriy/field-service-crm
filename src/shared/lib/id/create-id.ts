/**
 * Генерирует короткий локально-уникальный идентификатор.
 *
 * Состоит из временной метки (`Date.now` в системе счисления 36) и случайного
 * суффикса — этого достаточно для записей одного устройства (фото, локальные
 * сущности). Не криптостойкий и не глобально уникальный: внешних зависимостей
 * (`uuid`/`nanoid`/`expo-crypto`) в проекте нет, а гарантий уровня UUID здесь
 * не требуется.
 */
export function createId(): string {
  const timestamp = Date.now().toString(36);
  // Math.random здесь достаточно: это id локальной записи (фото), а не криптотокен — стойкость не нужна.
  // eslint-disable-next-line sonarjs/pseudo-random
  const random = Math.random().toString(36).slice(2, 10);

  return `${timestamp}${random}`;
}
