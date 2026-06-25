import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { type FC, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOrdersStore } from '@/entities/order';
import { Spacing, useColorScheme } from '@/shared/config';
import { configureNotifications } from '@/shared/lib/notifications';
import { ToastVariantEnum, useToastStore } from '@/shared/model';
import { Toast } from '@/shared/ui';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Авто-dismiss тоста, мс: короткое транзиентное сообщение об ошибке (PDR §11).
const TOAST_DURATION_MS = 4000;

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

const RootLayout: FC = () => {
  const colorScheme = useColorScheme();

  // Однократный bootstrap БД при старте (не-реактивный getState): инициализация SQLite, идемпотентный
  // сид, гидрация стора. initialize идемпотентен по флагу loading — StrictMode-дубль в dev безопасен.
  useEffect(() => {
    useOrdersStore.getState().initialize();
    // Создаём Android-канал напоминаний до первого планирования (на iOS — true сразу). Module-level
    // setNotificationHandler уже выставлен самим импортом сегмента notifications. При сбое канала —
    // мягкое уведомление пользователю (напоминания могут не работать), приложение продолжает работать.
    configureNotifications().then((ready) => {
      if (!ready) {
        useToastStore.getState().showToast(ToastVariantEnum.Info, 'Уведомления могут не работать');
      }
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="orders/[orderId]" options={{ headerShown: false }} />
          <Stack.Screen
            name="camera/[orderId]"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
        </Stack>
        <StatusBar style="auto" />
        <Toaster />
      </ThemeProvider>
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
