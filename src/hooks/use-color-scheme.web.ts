import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// Подписка-заглушка: значение гидрации не меняется после монтирования.
const emptySubscribe = () => () => {};

/**
 * Поддержка статического рендеринга: на сервере значение всегда 'light',
 * на клиенте после гидрации — реальная цветовая схема.
 */
export function useColorScheme(): 'light' | 'dark' {
  // getServerSnapshot возвращает false (сервер и первый рендер при гидрации),
  // getSnapshot — true (клиент), что даёт перерисовку без setState в эффекте.
  const hasHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme === 'dark' ? 'dark' : 'light';
  }

  return 'light';
}
