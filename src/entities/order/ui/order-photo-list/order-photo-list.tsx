import { type FC } from 'react';
import { StyleSheet, View } from 'react-native';

import type { IServiceOrderPhoto } from '../../model';
import { PhotoThumbnail } from '../photo-thumbnail';

import { Spacing } from '@/shared/config';

export interface IOrderPhotoListProps {
  photos: IServiceOrderPhoto[];
}

// Сетка миниатюр фотоотчёта: ~3 колонки (flexBasis 30% + grow), перенос на новую строку при >3.
export const OrderPhotoList: FC<IOrderPhotoListProps> = ({ photos }) => {
  return (
    <View style={styles.grid}>
      {photos.map((photo) => (
        <View key={photo.id} style={styles.cell}>
          <PhotoThumbnail photo={photo} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  cell: {
    flexBasis: '30%',
    flexGrow: 1,
  },
});
