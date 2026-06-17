import { Image } from 'expo-image';
import { type FC } from 'react';
import { StyleSheet } from 'react-native';

import type { IServiceOrderPhoto } from '../../model';

import { Radius, useColors } from '@/shared/config';

export interface IPhotoThumbnailProps {
  photo: IServiceOrderPhoto;
}

// Квадратная миниатюра фото (заполняет ячейку родителя). В Phase 2 mock-URI не резолвится —
// показывается surfaceMuted-плейсхолдер; реальные снимки появятся в Phase 5.
export const PhotoThumbnail: FC<IPhotoThumbnailProps> = ({ photo }) => {
  const colors = useColors();

  return (
    <Image
      source={{ uri: photo.uri }}
      style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}
      contentFit="cover"
    />
  );
};

const styles = StyleSheet.create({
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.md,
  },
});
