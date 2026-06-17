import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrderStatusLabel, type ServiceOrderStatusEnum } from '../../model';

import { FontSize, Radius, Spacing, useOrderStatusColors } from '@/shared/config';
import { Text } from '@/shared/ui';

export type IOrderStatusBadgeSize = 'sm' | 'md' | 'lg';

export interface IOrderStatusBadgeProps {
  status: ServiceOrderStatusEnum;
  size?: IOrderStatusBadgeSize;
}

interface ISizeConfig {
  fontSizeKey: keyof typeof FontSize;
  padV: number;
  padH: number;
}

// Размеры пилюли (контракт макета): sm fs11 pad 2×8 / md fs12 pad 4×10 / lg fs13 pad 6×12.
const SIZE = {
  sm: { fontSizeKey: '11', padV: Spacing['2'], padH: Spacing.xs },
  md: { fontSizeKey: 'xs', padV: Spacing.xxs, padH: Spacing['10'] },
  lg: { fontSizeKey: '13', padV: Spacing['6'], padH: Spacing.sm },
} as const satisfies Record<IOrderStatusBadgeSize, ISizeConfig>;

// Пилюля статуса заявки: цвета из статус-токенов темы, подпись из OrderStatusLabel (Done — «Готово»).
export const OrderStatusBadge: FC<IOrderStatusBadgeProps> = ({ status, size = 'md' }) => {
  const statusColors = useOrderStatusColors();
  const { background, text } = statusColors[status];
  const config = SIZE[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: background,
          paddingVertical: config.padV,
          paddingHorizontal: config.padH,
        },
      ]}
    >
      <Text size={config.fontSizeKey} weight="semibold" style={{ color: text }}>
        {OrderStatusLabel[status]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
  },
});
