import { Text as RNText, type TextProps } from 'react-native';

import { FontSize, FontWeight, useColors, type IColors } from '@/shared/config';

export interface ITextProps extends TextProps {
  size?: keyof typeof FontSize;
  weight?: keyof typeof FontWeight;
  color?: keyof IColors | string;
}

// Базовый текстовый примитив на токенах typography; цвет реактивен к системной теме.
export function Text({
  size = 'md',
  weight = 'regular',
  color = 'textPrimary',
  style,
  children,
  ...rest
}: ITextProps) {
  const colors = useColors();
  // Цвет — ключ палитры или произвольная строка (hex/rgba).
  const resolvedColor = color in colors ? colors[color as keyof IColors] : color;

  return (
    <RNText
      style={[
        { fontSize: FontSize[size], fontWeight: FontWeight[weight], color: resolvedColor },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
