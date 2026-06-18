import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { type FC, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useOrdersStore } from '@/entities/order';
import { useColorScheme } from '@/shared/config';

export const unstable_settings = {
  anchor: '(tabs)',
};

const RootLayout: FC = () => {
  const colorScheme = useColorScheme();

  // Однократный bootstrap БД при старте (не-реактивный getState): инициализация SQLite, идемпотентный
  // сид, гидрация стора. initialize идемпотентен по флагу loading — StrictMode-дубль в dev безопасен.
  useEffect(() => {
    useOrdersStore.getState().initialize();
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
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default RootLayout;
