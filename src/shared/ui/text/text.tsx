import type { FC } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

import { FontSize, FontWeight, useColors, type IColors } from '@/shared/config';

export interface ITextProps extends TextProps {
  size?: keyof typeof FontSize;
  weight?: keyof typeof FontWeight;
  color?: keyof IColors;
}

// Базовый текстовый примитив на токенах typography; цвет — ключ палитры, резолвится по системной теме.
export const Text: FC<ITextProps> = ({
  size = 'md',
  weight = 'regular',
  color = 'textPrimary',
  style,
  children,
  ...rest
}) => {
  const colors = useColors();

  return (
    <RNText
      style={[
        { fontSize: FontSize[size], fontWeight: FontWeight[weight], color: colors[color] },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
};
