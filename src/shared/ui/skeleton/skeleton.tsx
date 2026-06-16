import { useEffect, useState } from 'react';
import { Animated, type DimensionValue } from 'react-native';

import { Radius, useColors } from '@/shared/config';

export interface ISkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
}

// Плейсхолдер загрузки: блок surfaceMuted с пульсацией прозрачности.
export function Skeleton({ width = '100%', height = 16, radius = Radius.sm }: ISkeletonProps) {
  const colors = useColors();
  // Ленивая инициализация через useState — стабильная ссылка без доступа к ref в рендере.
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    // Бесконечная пульсация opacity для индикации загрузки.
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ width, height, borderRadius: radius, backgroundColor: colors.surfaceMuted, opacity }}
    />
  );
}
