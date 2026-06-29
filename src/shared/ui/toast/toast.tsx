import { useEffect, type ComponentProps, type FC } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '../icon-symbol';
import { Text } from '../text';

import { Radius, Shadows, Spacing, useColors, type IColors } from '@/shared/config';

// Вариант тоста определяет тинт фона/акцента и иконку. По значениям совпадает с ToastVariantEnum из
// shared/model, но объявлен локально — shared/ui остаётся business-agnostic (не импортирует model).
export type IToastVariant = 'error' | 'info' | 'success';

export interface IToastProps {
  message: string;
  variant?: IToastVariant;
  // Закрытие тоста (тап по плашке или авто-dismiss контейнера).
  onDismiss: () => void;
}

type IconName = ComponentProps<typeof IconSymbol>['name'];

interface IVariantStyle {
  surface: keyof IColors;
  accent: keyof IColors;
  icon: IconName;
}

// Маппинг варианта на токены палитры и иконку. Имя `error` семантическое — фон `dangerSurface`,
// иконка/текст — `dangerAccent` (`danger` зарезервирован под white-safe заливку кнопки).
const VARIANT_STYLE: Record<IToastVariant, IVariantStyle> = {
  error: {
    surface: 'dangerSurface',
    accent: 'dangerAccent',
    icon: 'exclamationmark.triangle.fill',
  },
  info: { surface: 'infoSurface', accent: 'info', icon: 'info.circle.fill' },
  success: { surface: 'successSurface', accent: 'success', icon: 'checkmark.circle.fill' },
};

// Презентационный тост: тинтованная плашка с иконкой и коротким сообщением, тап — закрытие. Появление
// анимируется reanimated (fade + slide). Позиционирование и safe-area — на контейнере (Toaster).
export const Toast: FC<IToastProps> = ({ message, variant = 'info', onDismiss }) => {
  const colors = useColors();
  const { surface, accent, icon } = VARIANT_STYLE[variant];

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-8);

  useEffect(() => {
    // Появление: проявление + лёгкий съезд сверху. Анимация конечная, но на размонтировании отменяем.
    opacity.value = withTiming(1, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(translateY);
    };
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[styles.toast, Shadows.card, { backgroundColor: colors.surface }]}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={message}
      >
        {/* Тинт варианта поверх сплошного surface: в тёмной теме surface-токены полупрозрачные (rgba),
            поэтому без подложки оверлей просвечивал бы контент под собой. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors[surface], borderRadius: Radius.md },
          ]}
          pointerEvents="none"
        />
        <IconSymbol name={icon} size={20} color={colors[accent]} />
        <Text size="sm" weight="medium" color={accent} style={styles.message}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  message: {
    flex: 1,
  },
});
