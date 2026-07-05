import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Возвращает `back`, защищённый от повторного тапа/двойного вызова: первый вызов ставит флаг и
 * зовёт `router.back()`, повторные (до размонтирования экрана) — no-op. Флаг не сбрасывается —
 * экран уходит из стека после первого вызова, повторный вызов на том же инстансе не имеет смысла.
 * Колбэк стабилен по ссылке (useCallback) — безопасно передавать в мемоизированные компоненты.
 */
export const useGuardedBack = (): (() => void) => {
  const router = useRouter();
  const isLeavingRef = useRef(false);

  return useCallback(() => {
    if (isLeavingRef.current) {
      return;
    }
    isLeavingRef.current = true;
    router.back();
  }, [router]);
};
