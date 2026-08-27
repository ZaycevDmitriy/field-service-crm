import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type FC, useEffect, useRef } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import type { AppStateStatus } from 'react-native';
import {
  AndroidSoftInputModes,
  KeyboardController,
  KeyboardProvider,
} from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { registerSyncRunner, requestSync, useOrdersStore } from '@/entities/order';
import {
  getAccessToken,
  logout,
  refreshSession,
  restoreSession,
  SessionStatusEnum,
  useSessionStore,
} from '@/entities/session';
import { sweepOrphanPhotos } from '@/features/photo-capture';
import { registerAuthBridge } from '@/shared/api';
import { Spacing, useColorScheme } from '@/shared/config';
import { logger } from '@/shared/lib/logger';
import { configureNotifications } from '@/shared/lib/notifications';
import { ToastVariantEnum, useToastStore } from '@/shared/model';
import { Toast } from '@/shared/ui';

// Программного управления сплэшем нет — expo-splash-screen подключён только как config-плагин
// (app.config.ts). Держим сплэш до первого разрешения статуса сессии (см. RootNavigator ниже),
// поэтому auto-hide отключаем на уровне модуля (до монтирования дерева).
SplashScreen.preventAutoHideAsync();

// Мост между business-agnostic shared/api и entities/session регистрируется здесь, на app-слое —
// это единственное место, которому разрешено знать про оба слайса одновременно (разрыв
// зависимости shared → entities). Модульный вызов: выполняется один раз при импорте файла, до
// первого рендера дерева и любых сетевых запросов.
registerAuthBridge({
  getAccessToken,
  refreshSession,
  onSessionExpired: () => {
    // Второй 401 после успешного refresh (например, аккаунт деактивирован сервером) — локальная
    // очистка сессии (logout идемпотентен и при уже сброшенном состоянии) плюс явное уведомление:
    // разлогин не должен быть молчаливым для пользователя.
    void logout();
    useToastStore.getState().showToast(ToastVariantEnum.Info, 'Сессия истекла');
  },
});

// QueryClient — модульный singleton (не в рендере), дефолтный networkMode ('online') не
// переопределяем (PDR client-sync §5). RQ в этой фазе — каркас: собственных useQuery/useMutation
// нет (данными владеет SQLite), см. риски плана фазы.
const queryClient = new QueryClient();

// onlineManager ← netinfo, модульный уровень (официальный RN-паттерн TanStack Query v5, сверено
// Context7 2026-07-22): в RN нет window-событий, проводка обязательна. Единый источник события
// «сеть восстановлена» для триггера оркестратора — второй NetInfo-листенер не заводим (см. эффект
// reconnect в RootLayout ниже, использует onlineManager.subscribe).
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

// Связывает оркестратор синка (entities/order/api/sync-orchestrator) со стором — цикл импортов
// store ↔ api предопределён (см. риск в плане фазы), поэтому оркестратор не импортирует стор
// напрямую, а зовёт зарегистрированный раннер (тот же паттерн, что registerAuthBridge выше).
registerSyncRunner(() => useOrdersStore.getState().syncOrders());

export const unstable_settings = {
  anchor: '(tabs)',
};

// Авто-dismiss тоста, мс: короткое транзиентное сообщение об ошибке (PDR §11).
const TOAST_DURATION_MS = 4000;

// Все URI фото из гидрированного стора — вход для sweepOrphanPhotos.
const getKnownPhotoUris = (): string[] =>
  useOrdersStore.getState().orders.flatMap((order) => order.photos.map((photo) => photo.uri));

// Глобальный контейнер тостов: подписан на toast-store, держит таймеры авто-dismiss и рендерит
// презентационные Toast оверлеем поверх Stack. Живёт на слое app (легально читает shared/model) —
// shared/ui при этом остаётся business-agnostic. Позиционирование и safe-area — здесь, не в Toast.
const Toaster: FC = () => {
  const insets = useSafeAreaInsets();
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const visible = new Set(toasts.map((toast) => toast.id));
    // Новым тостам — таймер авто-закрытия; существующим отсчёт не сбрасываем.
    toasts.forEach((toast) => {
      if (!timers.current.has(toast.id)) {
        timers.current.set(
          toast.id,
          setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS),
        );
      }
    });
    // Исчезнувшим тостам (закрыты тапом / вытеснены FIFO) — снять таймер.
    timers.current.forEach((timer, id) => {
      if (!visible.has(id)) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    });
  }, [toasts, dismissToast]);

  // Снять все таймеры при размонтировании контейнера.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.toaster, { top: insets.top + Spacing.sm }]}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </View>
  );
};

// Route guard (PDR «Решения дизайна» Phase 10): без сессии доступен только экран входа, с сессией —
// прежние экраны. `unknown` (до ответа restoreSession) трактуется как «ещё не вход» — экран входа
// технически смонтирован под сплэшем, но не виден (см. эффект скрытия сплэша ниже).
const RootNavigator: FC = () => {
  const sessionStatus = useSessionStore((state) => state.status);
  const isAuthenticated = sessionStatus === SessionStatusEnum.Authenticated;

  // Сплэш скрывается один раз, как только статус перестал быть Unknown (первый ответ restoreSession) —
  // не раньше, иначе экран входа/заявок мигнёт до того, как сессия определена.
  useEffect(() => {
    if (sessionStatus !== SessionStatusEnum.Unknown) {
      SplashScreen.hideAsync();
    }
  }, [sessionStatus]);

  return (
    <Stack>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="orders/[orderId]" options={{ headerShown: false }} />
        <Stack.Screen
          name="camera/[orderId]"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
};

const RootLayout: FC = () => {
  const colorScheme = useColorScheme();
  const sessionStatus = useSessionStore((state) => state.status);
  // Подписка на id, не на объект user: setSession кладёт новый объект — эффект синка ниже не должен
  // перезапускаться (и дёргать сетевой pull) от смены ссылки при том же пользователе.
  const userId = useSessionStore((state) => state.user?.id);
  // Промис bootstrap БД (эффект ниже) — эффект синка ждёт его перед bootstrapSync, не полагаясь
  // на порядок эффектов между рендерами. Ref, не state: сам промис не должен вызывать перерендер.
  const dbReadyRef = useRef<Promise<void> | null>(null);

  // Android: клавиатура не должна двигать/резать контент над ней (экраны сами управляют скроллом/
  // отступами). Вызов вынесен из render-фазы Toaster — побочный эффект внешнего модуля не должен
  // выполняться на каждый рендер компонента.
  useEffect(() => {
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
  }, []);

  // Восстановление сессии из SecureStore — параллельно с bootstrap БД ниже (независимые операции).
  // Пока статус остаётся Unknown, RootNavigator держит сплэш видимым (см. ниже).
  useEffect(() => {
    void restoreSession();
  }, []);

  // Однократный bootstrap БД при старте (не-реактивный getState): инициализация SQLite, идемпотентный
  // сид, гидрация стора. initialize идемпотентен по флагу loading — StrictMode-дубль в dev безопасен.
  useEffect(() => {
    // Sweep осиротевших фото — строго ПОСЛЕ гидрации стора (список известных URI должен быть полным)
    // и один раз за старт приложения (до открытия любых экранов съёмки). Промис сохраняется в
    // dbReadyRef — эффект синка ниже дожидается его перед первым bootstrapSync.
    dbReadyRef.current = useOrdersStore
      .getState()
      .initialize()
      .then(() => {
        const { error, loading } = useOrdersStore.getState();
        // Sweep только при подтверждённо успешной гидрации: при сбое БД initialize резолвится с
        // error и пустым стором, а StrictMode-дубль резолвится мгновенно (guard по loading), пока
        // первый вызов ещё гидрирует, — в обоих случаях sweep снёс бы все реальные фото как сироты.
        if (!error && !loading) {
          sweepOrphanPhotos(getKnownPhotoUris());
        }
      });
    // Создаём Android-канал напоминаний до первого планирования (на iOS — true сразу). Module-level
    // setNotificationHandler уже выставлен самим импортом сегмента notifications. При сбое канала —
    // мягкое уведомление пользователю (напоминания могут не работать), приложение продолжает работать.
    configureNotifications().then((ready) => {
      if (!ready) {
        useToastStore.getState().showToast(ToastVariantEnum.Info, 'Уведомления могут не работать');
      }
    });
  }, []);

  // Триггер синка (PDR client-sync §5/§8, T-07…T-10): логин, restoreSession с уже валидной сессией и
  // смена пользователя — везде, где sessionStatus/user.id меняются на аутентифицированные. Дожидается
  // dbReadyRef (bootstrap БД выше) — синковать в несуществующую схему нельзя. Ошибка внутри цикла не
  // блокирует вход: bootstrapSync сама не бросает (см. use-orders-store.ts) — офлайн-логин рабочий.
  useEffect(() => {
    if (sessionStatus !== SessionStatusEnum.Authenticated || !userId) {
      return;
    }
    dbReadyRef.current?.then(() => useOrdersStore.getState().bootstrapSync(userId));
  }, [sessionStatus, userId]);

  // focusManager ← AppState (официальный RN-паттерн TanStack Query v5) + триггеры оркестратора
  // (T8): переход в foreground и восстановление сети — оба гейтятся аутентифицированной сессией
  // (не-реактивное чтение getState(), обработчики event-driven, не должны зависеть от рендеров).
  // reconnect реагирует только на фронт offline→online (wasOnline) — второй NetInfo-листенер не
  // заводим, единый источник — onlineManager (проводка от netinfo на модульном уровне выше).
  useEffect(() => {
    const isAuthenticatedNow = (): boolean =>
      useSessionStore.getState().status === SessionStatusEnum.Authenticated;

    const onAppStateChange = (status: AppStateStatus): void => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
      if (status === 'active' && isAuthenticatedNow()) {
        logger.debug('[appLayout] Триггер синка.', { reason: 'appstate-active' });
        void requestSync();
      }
    };
    const appStateSubscription = AppState.addEventListener('change', onAppStateChange);

    let wasOnline = onlineManager.isOnline();
    const unsubscribeOnline = onlineManager.subscribe((isOnline) => {
      if (isOnline && !wasOnline && isAuthenticatedNow()) {
        logger.debug('[appLayout] Триггер синка.', { reason: 'reconnect' });
        void requestSync();
      }
      wasOnline = isOnline;
    });

    return () => {
      appStateSubscription.remove();
      unsubscribeOnline();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <RootNavigator />
            <StatusBar style="auto" />
            <Toaster />
          </ThemeProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  toaster: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    gap: Spacing.sm,
  },
});

export default RootLayout;
