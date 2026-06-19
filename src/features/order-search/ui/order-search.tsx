import { type FC } from 'react';

import { useOrdersStore } from '@/entities/order';
import { SearchInput } from '@/shared/ui';

// Поиск по заявкам: поле с доменным placeholder (PDR §12). Самоподписан на стор — ввод
// перерисовывает только сам инпут, закреплённая шапка (OrdersListHeader) от этого изолирована.
export const OrderSearch: FC = () => {
  const value = useOrdersStore((state) => state.search);
  const setSearch = useOrdersStore((state) => state.setSearch);

  return (
    <SearchInput
      value={value}
      onChangeText={setSearch}
      placeholder="Поиск по клиенту или адресу"
      autoCorrect={false}
      returnKeyType="search"
    />
  );
};
