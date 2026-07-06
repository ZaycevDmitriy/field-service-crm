import { Image } from 'expo-image';
import { type FC } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IServiceOrderPhoto } from '@/entities/order';
import { Radius, Spacing, useColors } from '@/shared/config';
import { Button, ScreenHeader, Text } from '@/shared/ui';

export interface IPhotoViewerModalProps {
  // Просматриваемое фото; null — модалка скрыта.
  photo: IServiceOrderPhoto | null;
  // Удаление доступно только у заявки в работе (InProgress) — доменное правило.
  canDelete: boolean;
  onDelete: (photoId: string) => void;
  onClose: () => void;
}

// Полноэкранный просмотр фото фотоотчёта: снимок, комментарий и (для заявки в работе) удаление.
// Непереиспользуемый блок страницы деталей — живёт в слайсе order-details, не в entities/shared.
export const PhotoViewerModal: FC<IPhotoViewerModalProps> = ({
  photo,
  canDelete,
  onDelete,
  onClose,
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Та же защита, что в PhotoThumbnail: mock-URI сид-данных в expo-image не передаём.
  const source = photo && /^(https?:|file:)/.test(photo.uri) ? { uri: photo.uri } : null;

  return (
    <Modal
      visible={photo !== null}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ScreenHeader title="Фото" onBack={onClose} />
        <View style={[styles.body, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Image
            source={source}
            style={[styles.image, { backgroundColor: colors.surfaceMuted }]}
            contentFit="contain"
          />
          {photo?.comment ? (
            <View style={[styles.commentCard, { backgroundColor: colors.surface }]}>
              <Text size="13" color="textSecondary">
                Комментарий
              </Text>
              <Text size="15">{photo.comment}</Text>
            </View>
          ) : null}
          {canDelete && photo ? (
            <Button
              title="Удалить фото"
              variant="danger"
              fullWidth
              onPress={() => onDelete(photo.id)}
            />
          ) : null}
        </View>
      </View>
    </Modal>
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
    gap: Spacing.md,
  },
  image: {
    flex: 1,
    width: '100%',
    borderRadius: Radius.md,
  },
  commentCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing['2'],
  },
});
