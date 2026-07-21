// В jest (node) нет нативной части react-native-worklets, поэтому импорт reanimated через barrel UI
// (skeleton → react-native-reanimated → react-native-worklets) падает с «Native part of Worklets
// doesn't seem to be initialized». Подменяем worklets его официальным JS-моком — reanimated
// инициализируется поверх мока без нативного рантайма (jest-expo SDK 56 этот модуль не мокает).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Глушим логгер во всех тестах: диагностика пишется через logger (в jest __DEV__=true → console.log),
// и ожидаемый вывод (в т.ч. намеренно спровоцированные error-ветки) иначе шумит в CI-логах прогона.
// Поведение тесты проверяют по стору/тостам/UI, не по консоли. Мок вешается на публичный барел
// `@/shared/lib/logger`, через который импортят все потребители; сам logger.test.ts импортит внутренний
// `../logger` напрямую (мимо барела), поэтому проверяет реальный вывод и мок его не трогает.
// location-service.test.ts переопределяет мок локально своим jest.mock (ассертит logger.debug).
jest.mock('@/shared/lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
