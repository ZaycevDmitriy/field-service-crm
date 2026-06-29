import { Image } from 'expo-image';
import { type FC, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardGestureArea } from 'react-native-keyboard-controller';

import { Radius, Spacing, useColors } from '@/shared/config';
import { Button, Input, Text } from '@/shared/ui';

// Связывает KeyboardGestureArea с полем комментария (textInputNativeID обязателен на iOS).
const COMMENT_INPUT_ID = 'photo-comment-input';

export interface IPhotoPreviewProps {
  // Абсолютный URI снятого/выбранного фото для предпросмотра.
  uri: string;
  // Передаёт комментарий наружу при сохранении (комментарий хранится в local state экрана).
  onSave: (comment: string) => void;
  onRetake: () => void;
}

export const PhotoPreview: FC<IPhotoPreviewProps> = ({ uri, onSave, onRetake }) => {
  const colors = useColors();
  const [comment, setComment] = useState('');

  return (
    <KeyboardGestureArea
      interpolator="ios"
      textInputNativeID={COMMENT_INPUT_ID}
      style={styles.gestureArea}
    >
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        bottomOffset={170}
      >
        <Image
          source={{ uri }}
          contentFit="cover"
          style={[styles.preview, { backgroundColor: colors.surfaceMuted }]}
        />
        <View style={styles.commentBlock}>
          <Text size="13" weight="semibold" color="textSecondary" style={styles.label}>
            Комментарий
          </Text>
          <Input
            nativeID={COMMENT_INPUT_ID}
            value={comment}
            onChangeText={setComment}
            placeholder="Комментарий к фото"
            multiline
            style={styles.input}
          />
        </View>
        <View style={styles.actions}>
          <Button
            title="Сохранить фото"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => onSave(comment)}
          />
          <Button title="Переснять" variant="secondary" fullWidth onPress={onRetake} />
        </View>
      </KeyboardAwareScrollView>
    </KeyboardGestureArea>
  );
};

const styles = StyleSheet.create({
  gestureArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    gap: Spacing.md,
  },
  preview: {
    height: 320,
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
