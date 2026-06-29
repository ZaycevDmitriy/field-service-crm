import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { type FC, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { photoService } from '../lib/photoService';

import { Radius, Spacing } from '@/shared/config';
import { logger } from '@/shared/lib/logger';
import { ToastVariantEnum, useToastStore } from '@/shared/model';
import { Button, IconButton, IconSymbol, Text } from '@/shared/ui';

export interface IPhotoCaptureViewProps {
  // Вызывается с абсолютным URI снятого/выбранного и сохранённого в постоянное хранилище фото.
  onCaptured: (uri: string) => void;
  // Закрытие экрана съёмки без результата.
  onClose: () => void;
}

// Экран съёмки намеренно theme-independent (контракт дизайна: Capture тёмный вне зависимости от
// системной схемы) — фиксированные цвета, а не токены темы.
const CAMERA = {
  bg: '#0b0d10',
  muted: 'rgba(255,255,255,0.60)',
  tile: 'rgba(255,255,255,0.12)',
  shutter: '#FFFFFF',
  shutterRing: 'rgba(255,255,255,0.30)',
  // Светлый синий для ghost-действия («Выбрать из галереи»): фикс, экран theme-independent (тема не
  // годится — light-accent на near-black даёт ~3.4); ≥4.5 на bg.
  action: '#8AB0F5',
} as const;

interface IControlButtonProps {
  icon: 'photo.on.rectangle' | 'arrow.triangle.2.circlepath.camera.fill';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

// Боковой контрол камеры (галерея / переключение камеры): плитка 48 + подпись.
const ControlButton: FC<IControlButtonProps> = ({ icon, label, onPress, disabled = false }) => {
  return (
    <Pressable
      style={[styles.control, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
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

// Экран съёмки: реальная камера (CameraView) + контролы (галерея/затвор/переключение). Шторка
// активна только после onCameraReady (решение 8) и не во время обработки снимка. Разрешение камеры —
// реактивно через useCameraPermissions; отказ не блокирует флоу (галерея и закрытие доступны).
export const PhotoCaptureView: FC<IPhotoCaptureViewProps> = ({ onCaptured, onClose }) => {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [isCameraReady, setIsCameraReady] = useState(false);
  // Блокирует параллельные захваты (двойной тап шторки/галереи) на время съёмки и сохранения.
  const [isBusy, setIsBusy] = useState(false);
  // Камера не смонтировалась (onMountError) — показываем фоллбэк с галереей вместо CameraView.
  const [cameraMountError, setCameraMountError] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted) {
      logger.warn('[PhotoCaptureView] Доступ к камере не предоставлен.');
    }
  }, [permission]);

  // Сохраняет временный URI в постоянное хранилище и отдаёт наружу. tempUri === null — съёмка/выбор
  // не дали результата (отмена/сбой), молча выходим.
  const persistAndEmit = async (tempUri: string | null): Promise<void> => {
    if (!tempUri) {
      return;
    }
    const uri = await photoService.persistPhoto(tempUri);
    onCaptured(uri);
  };

  const handleShutter = async (): Promise<void> => {
    if (!cameraRef.current || !isCameraReady || isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      const tempUri = await photoService.capturePhoto(cameraRef.current);
      // capturePhoto возвращает null только при сбое (отмены у съёмки нет) — сообщаем тостом.
      if (!tempUri) {
        useToastStore.getState().showToast(ToastVariantEnum.Error, 'Не удалось сделать снимок');

        return;
      }
      await persistAndEmit(tempUri);
    } finally {
      setIsBusy(false);
    }
  };

  const handleGallery = async (): Promise<void> => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await persistAndEmit(await photoService.pickPhotoFromLibrary());
    } finally {
      setIsBusy(false);
    }
  };

  const toggleFacing = () => setFacing((current) => (current === 'back' ? 'front' : 'back'));
  const toggleFlash = () => setFlash((current) => (current === 'off' ? 'on' : 'off'));

  const handleRequestPermission = () => {
    // Пока система разрешает спрашивать — нативный запрос; иначе ведём в системные настройки.
    if (permission?.canAskAgain) {
      requestPermission();
    } else {
      Linking.openSettings().catch((error) => {
        logger.warn('[PhotoCaptureView] Не удалось открыть настройки.', error);
      });
    }
  };

  const rootStyle = [
    styles.root,
    { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.lg },
  ];

  // Статус разрешения ещё загружается.
  if (!permission) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={CAMERA.shutter} />
      </View>
    );
  }

  // Отказ в разрешении камеры — неблокирующий UI: галерея и закрытие остаются доступны (PDR §15 acc. 1).
  if (!permission.granted) {
    return (
      <View style={rootStyle}>
        <View style={styles.header}>
          <IconButton
            icon="xmark"
            accessibilityLabel="Закрыть"
            color={CAMERA.shutter}
            onPress={onClose}
          />
          <Text weight="semibold" color="white">
            Фотоотчёт
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.deniedBody}>
          <IconSymbol name="camera.fill" size={48} color={CAMERA.muted} />
          <Text style={styles.deniedText}>
            Чтобы сделать фото, разрешите доступ к камере. Можно также выбрать изображение из
            галереи.
          </Text>
          <View style={styles.deniedActions}>
            <Button
              title={permission.canAskAgain ? 'Разрешить доступ' : 'Открыть настройки'}
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleRequestPermission}
            />
            <Button
              title="Выбрать из галереи"
              variant="ghost"
              fullWidth
              disabled={isBusy}
              textColor={CAMERA.action}
              onPress={() => {
                void handleGallery();
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  // Камера смонтировалась с ошибкой (onMountError) — фоллбэк с галереей, как при отказе в доступе.
  if (cameraMountError) {
    return (
      <View style={rootStyle}>
        <View style={styles.header}>
          <IconButton
            icon="xmark"
            accessibilityLabel="Закрыть"
            color={CAMERA.shutter}
            onPress={onClose}
          />
          <Text weight="semibold" color="white">
            Фотоотчёт
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.deniedBody}>
          <IconSymbol name="camera.fill" size={48} color={CAMERA.muted} />
          <Text style={styles.deniedText}>Камера недоступна. Выберите фото из галереи.</Text>
          <View style={styles.deniedActions}>
            <Button
              title="Выбрать из галереи"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isBusy}
              onPress={() => {
                void handleGallery();
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  // Разрешение получено — камера и контролы съёмки.
  return (
    <View style={rootStyle}>
      <View style={styles.header}>
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
          icon={flash === 'on' ? 'bolt.fill' : 'bolt.slash.fill'}
          accessibilityLabel={flash === 'on' ? 'Выключить вспышку' : 'Включить вспышку'}
          color={CAMERA.shutter}
          onPress={toggleFlash}
        />
      </View>

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        mode="picture"
        onCameraReady={() => setIsCameraReady(true)}
        onMountError={(event) => {
          logger.error('[PhotoCaptureView] Камера не запустилась.', event.message);
          setCameraMountError(true);
        }}
      />

      <View style={styles.controls}>
        <ControlButton
          icon="photo.on.rectangle"
          label="Галерея"
          disabled={isBusy}
          onPress={() => {
            void handleGallery();
          }}
        />
        <Pressable
          style={[styles.shutter, (!isCameraReady || isBusy) && styles.disabled]}
          onPress={() => {
            void handleShutter();
          }}
          disabled={!isCameraReady || isBusy}
          accessibilityRole="button"
          accessibilityLabel="Сделать фото"
        />
        <ControlButton
          icon="arrow.triangle.2.circlepath.camera.fill"
          label="Камера"
          disabled={isBusy}
          onPress={toggleFacing}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CAMERA.bg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  camera: {
    flex: 1,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  deniedBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  deniedText: {
    color: CAMERA.muted,
    textAlign: 'center',
  },
  deniedActions: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
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
  disabled: {
    opacity: 0.4,
  },
});
