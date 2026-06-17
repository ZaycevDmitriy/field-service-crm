import { type FC, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing, useColors } from '@/shared/config';
import { Button, Input, Text } from '@/shared/ui';

export interface IPhotoPreviewProps {
  onSave: () => void;
  onRetake: () => void;
}

// Предпросмотр снимка (заглушка Phase 2): плейсхолдер-превью растягивается на доступную высоту,
// поле комментария и действия «Сохранить»/«Переснять» закреплены снизу (без прокрутки).
// Комментарий — временное состояние экрана, хранится в local state (PDR §13).
export const PhotoPreview: FC<IPhotoPreviewProps> = ({ onSave, onRetake }) => {
  const colors = useColors();
  const [comment, setComment] = useState('');

  return (
    <View style={styles.container}>
      <View style={[styles.preview, { backgroundColor: colors.surfaceMuted }]} />
      <View style={styles.commentBlock}>
        <Text size="13" weight="semibold" color="textSecondary" style={styles.label}>
          Комментарий
        </Text>
        <Input
          value={comment}
          onChangeText={setComment}
          placeholder="Комментарий к фото"
          multiline
          style={styles.input}
        />
      </View>
      <View style={styles.actions}>
        <Button title="Сохранить фото" variant="primary" size="lg" fullWidth onPress={onSave} />
        <Button title="Переснять" variant="secondary" fullWidth onPress={onRetake} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.md,
  },
  preview: {
    flex: 1,
    width: '100%',
    borderRadius: Radius.lg,
  },
  commentBlock: {
    gap: Spacing.xs,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    height: 120,
    paddingTop: Spacing.sm,
    textAlignVertical: 'top',
  },
  actions: {
    gap: Spacing.sm,
  },
});
