import { useNavigation, useRouter } from 'expo-router';
import { type FC, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOrdersStore } from '@/entities/order';
import { deletePhoto, PhotoPreview } from '@/features/photo-capture';
import { Spacing, useColors } from '@/shared/config';
import { useGuardedBack } from '@/shared/lib/navigation';
import { ScreenHeader } from '@/shared/ui';

export interface IPhotoPreviewPageProps {
  // Id заявки, к которой привязывается фото.
  orderId: string;
  // Абсолютный file://-URI снятого фото (пришёл search-параметром маршрута).
  uri: string;
}

export const PhotoPreviewPage: FC<IPhotoPreviewPageProps> = ({ orderId, uri }) => {
  const router = useRouter();
  const navigation = useNavigation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const addOrderPhoto = useOrdersStore((state) => state.addOrderPhoto);
  // Снимок копируется в постоянное хранилище ДО подтверждения (см. photoService.persistPhoto) — без
  // этого флага beforeRemove удалил бы только что сохранённое фото (dismissTo тоже его триггерит).
  const savedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      KeyboardController.dismiss();
      if (!savedRef.current) {
        // Orphan-cleanup: пользователь ушёл с экрана без сохранения («Назад»/«Переснять») —
        // удаляем уже скопированный файл. Синхронный вызов, не бросает — не блокирует навигацию.
        deletePhoto(uri);
      }
    });

    return unsubscribe;
  }, [navigation, uri]);

  // «Назад» и «Переснять» — один возврат к экрану съёмки (он остаётся в стеке под card).
  const handleBack = useGuardedBack();

  const handleSave = (comment: string) => {
    // Guard двойного тапа: PhotoPreview блокирует свою кнопку по локальному saving-стейту, но за
    // ~300 мс анимации dismissTo (ниже) второй onPress может успеть долететь раньше ре-рендера —
    // без этой проверки addOrderPhoto/router.dismissTo отработали бы дважды и создали дубль фото.
    if (savedRef.current) {
      return;
    }
    savedRef.current = true;
    // Доменную сборку фото (id/createdAt) делает стор; здесь — только привязка к заявке.
    addOrderPhoto(orderId, { uri, comment });
    // dismissTo снимает модальную группу camera/[orderId] (и съёмку, и предпросмотр) и возвращает
    // на карточку заявки — она реактивно покажет новое фото из стора.
    router.dismissTo({ pathname: '/orders/[orderId]', params: { orderId } });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScreenHeader title="Предпросмотр" onBack={handleBack} />
      <View style={[styles.body, { paddingBottom: insets.bottom + Spacing.md }]}>
        <PhotoPreview uri={uri} onSave={handleSave} onRetake={handleBack} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
});
