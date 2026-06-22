// В jest (node) нет нативной части react-native-worklets, поэтому импорт reanimated через barrel UI
// (skeleton → react-native-reanimated → react-native-worklets) падает с «Native part of Worklets
// doesn't seem to be initialized». Подменяем worklets его официальным JS-моком — reanimated
// инициализируется поверх мока без нативного рантайма (jest-expo SDK 56 этот модуль не мокает).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
