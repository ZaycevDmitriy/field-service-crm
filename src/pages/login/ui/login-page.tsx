import { type FC, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { login } from '@/entities/session';
import { ApiErrorCodeEnum, isApiErrorEnvelope } from '@/shared/api';
import { Radius, Spacing, useColors } from '@/shared/config';
import { Button, IconSymbol, Input, Text } from '@/shared/ui';

// Читаемое сообщение по коду ошибки входа, без технических деталей (DoD фазы: «неверные данные /
// lockout → читаемые сообщения»). Не-конверт (нативный сбой SecureStore внутри login и т.п.) и
// прочие коды (internal_error) — маловероятны на логине, общий фоллбэк.
const resolveLoginErrorMessage = (error: unknown): string => {
  if (!isApiErrorEnvelope(error)) {
    return 'Не удалось войти. Попробуйте ещё раз.';
  }

  switch (error.code) {
    case ApiErrorCodeEnum.InvalidCredentials:
      return 'Неверный email или пароль';
    case ApiErrorCodeEnum.TooManyAttempts:
      return 'Слишком много попыток — попробуйте позже';
    case ApiErrorCodeEnum.NetworkError:
      return 'Нет соединения с сервером';
    default:
      return 'Не удалось войти. Попробуйте ещё раз.';
  }
};

// Экран входа — обязательный шаг перед доступом к заявкам (Phase 10, PDR §8 этап 1). Локальное
// состояние формы (PDR §13): экран не переиспользуется, стор сессии ему для этого не нужен.
export const LoginPage: FC = () => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const handleSubmit = async (): Promise<void> => {
    setErrorMessage(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Успех: entities/session переводит статус в Authenticated — route guard в src/app/_layout.tsx
      // сам скрывает экран входа, явная навигация отсюда не нужна.
    } catch (error) {
      setErrorMessage(resolveLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.xxl,
          paddingBottom: Math.max(insets.bottom, Spacing.md),
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="interactive"
      bottomOffset={170}
    >
      <View style={styles.header}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <IconSymbol name="lock.fill" size={26} color={colors.white} />
        </View>
        <Text size="xl" weight="bold">
          Onsite
        </Text>
        <Text size="15" color="textSecondary" style={styles.subtitle}>
          Войдите, чтобы продолжить работу с заявками
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text size="13" weight="semibold" color="textSecondary">
            Email
          </Text>
          <Input
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@onsite.dev"
            editable={!loading}
            returnKeyType="next"
            testID="login-email-input"
            accessibilityLabel="Email, поле ввода"
          />
        </View>

        <View style={styles.field}>
          <Text size="13" weight="semibold" color="textSecondary">
            Пароль
          </Text>
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Пароль"
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit()}
            testID="login-password-input"
            accessibilityLabel="Пароль, поле ввода"
          />
        </View>

        {errorMessage ? (
          <Text size="13" color="dangerAccent">
            {errorMessage}
          </Text>
        ) : null}

        <Button
          title="Войти"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!canSubmit}
          onPress={() => void handleSubmit()}
          testID="login-submit-button"
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
  },
  form: {
    gap: Spacing.md,
  },
  field: {
    gap: Spacing.xs,
  },
});
