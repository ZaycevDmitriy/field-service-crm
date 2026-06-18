import { useRouter } from 'expo-router';
import { type FC, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoCaptureView, PhotoPreview } from '@/features/photo-capture';
import { useOrdersStore } from '@/entities/order';
import { Spacing, useColors } from '@/shared/config';
import { ScreenHeader } from '@/shared/ui';

export interface IPhotoPageProps {
  // Id заявки, к которой привязывается снятое/выбранное фото.
  orderId: string;
}

interface IPreviewScreenProps {
  uri: string;
  onBack: () => void;
  onSave: (comment: string) => void;
  onRetake: () => void;
}

// Экран предпросмотра: светлый (наследует тему), шапка + содержимое из feature PhotoPreview.
const PreviewScreen: FC<IPreviewScreenProps> = ({ uri, onBack, onSave, onRetake }) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.previewRoot, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      <ScreenHeader title="Предпросмотр" onBack={onBack} />
      <View style={[styles.previewBody, { paddingBottom: insets.bottom + Spacing.md }]}>
        <PhotoPreview uri={uri} onSave={onSave} onRetake={onRetake} />
      </View>
    </View>
  );
};

// Экран фото — тонкий оркестратор: Capture (feature PhotoCaptureView) → Preview через local state.
// Снятый URI и режим — временное состояние экрана (local state, PDR §13). Тёмный UI камеры и сервисы
// живут в feature; страница лишь связывает результат съёмки с заявкой.
export const PhotoPage: FC<IPhotoPageProps> = ({ orderId }) => {
  const router = useRouter();
  const [mode, setMode] = useState<'capture' | 'preview'>('capture');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const handleClose = () => router.back();

  const handleCaptured = (uri: string) => {
    setPhotoUri(uri);
    setMode('preview');
  };

  const handleRetake = () => {
    setPhotoUri(null);
    setMode('capture');
  };

  const handleSave = (comment: string) => {
    if (photoUri) {
      // Доменную сборку фото (id/createdAt) делает стор; здесь — только привязка к заявке.
      useOrdersStore.getState().addOrderPhoto(orderId, { uri: photoUri, comment });
    }
    router.back();
  };

  if (mode === 'preview' && photoUri) {
    return (
      <PreviewScreen
        uri={photoUri}
        onBack={handleClose}
        onSave={handleSave}
        onRetake={handleRetake}
      />
    );
  }

  return <PhotoCaptureView onCaptured={handleCaptured} onClose={handleClose} />;
};

const styles = StyleSheet.create({
  previewRoot: {
    flex: 1,
  },
  previewBody: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
});
