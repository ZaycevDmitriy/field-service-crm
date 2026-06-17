import { useEffect, type FC } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, useColors } from '@/shared/config';

export interface ISkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
}

// Плейсхолдер загрузки: блок surfaceMuted с пульсацией прозрачности.
export const Skeleton: FC<ISkeletonProps> = ({
  width = '100%',
  height = 16,
  radius = Radius.sm,
}) => {
  const colors = useColors();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    // Бесконечная пульсация opacity (reverse) для индикации загрузки.
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);

    // Явная остановка бесконечной анимации при размонтировании.
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surfaceMuted },
        animatedStyle,
      ]}
    />
  );
};
