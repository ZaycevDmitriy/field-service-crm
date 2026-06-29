import { Stack } from 'expo-router';
import { type FC } from 'react';

// Якорь вложенного стека: при deep-link напрямую в preview под ним сохраняется index (съёмка),
// чтобы «назад» вёл к камере, а не выкидывал из группы (Expo Router modals: anchor).
export const unstable_settings = {
  anchor: 'index',
};

// Вложенный навигатор группы camera/[orderId]. Всю группу корневой стек презентует как
// fullScreenModal (камера выезжает снизу), а ВНУТРИ index→preview — обычный горизонтальный card-push.
// Это обязательно: card-сосед в корневом стексе уезжал бы ПОД модально показанную камеру (на iOS
// fullScreenModal не создаёт вложенный стек) и был бы не виден. Вложенный стек создаёт контекст,
// в котором preview корректно перекрывает съёмку.
const CameraLayout: FC = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="preview" />
    </Stack>
  );
};

export default CameraLayout;
