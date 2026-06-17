import { useRouter } from 'expo-router';
import { type FC, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoPreview } from '@/features/photo-capture';
import { Radius, Spacing, useColors } from '@/shared/config';
import { IconButton, IconSymbol, ScreenHeader, Text } from '@/shared/ui';

// Экран камеры намеренно theme-independent (имитация камеры) — фиксированные цвета, а не токены темы
// (контракт дизайна: Capture тёмный #0b0d10 вне зависимости от системной схемы).
const CAMERA = {
  bg: '#0b0d10',
  viewfinder: '#15181d',
  bracket: 'rgba(255,255,255,0.40)',
  muted: 'rgba(255,255,255,0.60)',
  tile: 'rgba(255,255,255,0.12)',
  shutter: '#FFFFFF',
  shutterRing: 'rgba(255,255,255,0.30)',
} as const;

interface IControlButtonProps {
  icon: 'photo.on.rectangle' | 'arrow.triangle.2.circlepath.camera.fill';
  label: string;
  onPress: () => void;
}

// Боковой контрол камеры (галерея / переключение камеры): плитка 48 + подпись.
const ControlButton: FC<IControlButtonProps> = ({ icon, label, onPress }) => {
  return (
    <Pressable
      style={styles.control}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.controlTile}>
        <IconSymbol name={icon} size={22} color={CAMERA.shutter} />
      </View>
      <Text size="11" style={styles.controlLabel}>
        {label}
      </Text>
    </Pressable>
  );
};

interface ICaptureScreenProps {
  onClose: () => void;
  onCapture: () => void;
}

// Экран съёмки: тёмный, header (закрыть/заголовок/вспышка), viewfinder-заглушка, controls (галерея/затвор/камера).
const CaptureScreen: FC<ICaptureScreenProps> = ({ onClose, onCapture }) => {
  const insets = useSafeAreaInsets();
  // Заглушки управления камерой — реальная камера в Phase 5.
  const noop = () => undefined;

  return (
    <View
      style={[
        styles.captureRoot,
        { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.lg },
      ]}
    >
      <View style={styles.captureHeader}>
        <IconButton
          icon="xmark"
          accessibilityLabel="Закрыть"
          color={CAMERA.shutter}
          onPress={onClose}
        />
        <Text weight="semibold" color="white">
          Фотоотчёт
        </Text>
        <IconButton
          icon="bolt.fill"
          accessibilityLabel="Вспышка"
          color={CAMERA.shutter}
          onPress={noop}
        />
      </View>

      <View style={[styles.viewfinder, { backgroundColor: CAMERA.viewfinder }]}>
        <View style={[styles.bracket, styles.bracketTL]} />
        <View style={[styles.bracket, styles.bracketTR]} />
        <View style={[styles.bracket, styles.bracketBL]} />
        <View style={[styles.bracket, styles.bracketBR]} />
        <Text size="sm" style={styles.viewfinderText}>
          [ camera viewfinder ]
        </Text>
      </View>

      <View style={styles.controls}>
        <ControlButton icon="photo.on.rectangle" label="Галерея" onPress={noop} />
        <Pressable
          style={styles.shutter}
          onPress={onCapture}
          accessibilityRole="button"
          accessibilityLabel="Сделать фото"
        />
        <ControlButton
          icon="arrow.triangle.2.circlepath.camera.fill"
          label="Камера"
          onPress={noop}
        />
      </View>
    </View>
  );
};

interface IPreviewScreenProps {
  onBack: () => void;
  onSave: () => void;
  onRetake: () => void;
}

// Экран предпросмотра: светлый (наследует тему), шапка + содержимое из feature PhotoPreview.
const PreviewScreen: FC<IPreviewScreenProps> = ({ onBack, onSave, onRetake }) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.previewRoot, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      <ScreenHeader title="Предпросмотр" onBack={onBack} />
      <View style={[styles.previewBody, { paddingBottom: insets.bottom + Spacing.md }]}>
        <PhotoPreview onSave={onSave} onRetake={onRetake} />
      </View>
    </View>
  );
};

// Экран фото: Capture (съёмка) → Preview (предпросмотр) через local state. Заглушки Phase 2.
export const PhotoPage: FC = () => {
  const router = useRouter();
  const [mode, setMode] = useState<'capture' | 'preview'>('capture');

  const handleClose = () => router.back();
  const handleCapture = () => setMode('preview');
  const handleSave = () => router.back();
  const handleRetake = () => setMode('capture');

  if (mode === 'preview') {
    return <PreviewScreen onBack={handleClose} onSave={handleSave} onRetake={handleRetake} />;
  }

  return <CaptureScreen onClose={handleClose} onCapture={handleCapture} />;
};

const styles = StyleSheet.create({
  captureRoot: {
    flex: 1,
    backgroundColor: CAMERA.bg,
  },
  captureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  viewfinder: {
    flex: 1,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: CAMERA.bracket,
  },
  bracketTL: {
    top: Spacing.md,
    left: Spacing.md,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  bracketTR: {
    top: Spacing.md,
    right: Spacing.md,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  bracketBL: {
    bottom: Spacing.md,
    left: Spacing.md,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  bracketBR: {
    bottom: Spacing.md,
    right: Spacing.md,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  viewfinderText: {
    color: CAMERA.muted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  control: {
    alignItems: 'center',
    gap: Spacing.xxs,
    width: 64,
  },
  controlTile: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: CAMERA.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    color: CAMERA.muted,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: Radius.pill,
    backgroundColor: CAMERA.shutter,
    borderWidth: 4,
    borderColor: CAMERA.shutterRing,
  },
  previewRoot: {
    flex: 1,
  },
  previewBody: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
});
