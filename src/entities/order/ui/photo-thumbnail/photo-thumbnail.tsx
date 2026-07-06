import { Image } from 'expo-image';
import { type FC } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import type { IServiceOrderPhoto } from '../../model';

import { Radius, useColors } from '@/shared/config';

export interface IPhotoThumbnailProps {
  photo: IServiceOrderPhoto;
  // Тап по миниатюре (открытие просмотра). Без колбэка миниатюра остаётся статичной картинкой.
  onPress?: () => void;
}

// Квадратная миниатюра фото (заполняет ячейку родителя). В Phase 2 mock-URI не резолвится —
// показывается surfaceMuted-плейсхолдер; реальные снимки появятся в Phase 5.
export const PhotoThumbnail: FC<IPhotoThumbnailProps> = ({ photo, onPress }) => {
  const colors = useColors();
  // В Phase 2 URI — mock-плейсхолдер; невалидную схему в expo-image не передаём (иначе ошибки загрузки).
  // Реальные http(s)/file-снимки появятся в Phase 5 и отрисуются поверх surfaceMuted-фона.
  const source = /^(https?:|file:)/.test(photo.uri) ? { uri: photo.uri } : null;

  const image = (
    <Image
      source={source}
      style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}
      contentFit="cover"
    />
  );

  if (!onPress) {
    return image;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Открыть фото"
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      {image}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
