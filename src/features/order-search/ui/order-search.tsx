import { type FC } from 'react';

import { SearchInput } from '@/shared/ui';

export interface IOrderSearchProps {
  value: string;
  onChangeText: (text: string) => void;
}

// Поиск по заявкам: поле поиска с доменным placeholder (PDR §12). Фильтрация — Phase 3.
export const OrderSearch: FC<IOrderSearchProps> = ({ value, onChangeText }) => {
  return (
    <SearchInput
      value={value}
      onChangeText={onChangeText}
      placeholder="Поиск по клиенту или адресу"
      autoCorrect={false}
      returnKeyType="search"
    />
  );
};
