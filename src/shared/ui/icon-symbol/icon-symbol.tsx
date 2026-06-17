// Фолбэк: MaterialIcons на Android и web.

import MaterialIcons from '@react-native-vector-icons/material-icons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

// В expo-symbols 56 name стал SFSymbol | { ios?; android?; web? } — берём строковую часть для ключа.
type IconMapping = Record<
  Extract<SymbolViewProps['name'], string>,
  ComponentProps<typeof MaterialIcons>['name']
>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Добавляйте сюда сопоставления SF Symbols → Material Icons.
 * - Material Icons — каталог иконок: https://icons.expo.fyi.
 * - SF Symbols — приложение: https://developer.apple.com/sf-symbols/.
 */
const MAPPING = {
  'house.fill': 'home',
  'list.bullet': 'list',
  'gearshape.fill': 'settings',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  xmark: 'close',
  magnifyingglass: 'search',
  mappin: 'place',
  clock: 'schedule',
  'arrow.triangle.turn.up.right.diamond.fill': 'directions',
  'camera.fill': 'photo-camera',
  'qrcode.viewfinder': 'qr-code-scanner',
  'externaldrive.fill': 'storage',
  'wifi.slash': 'wifi-off',
  'exclamationmark.triangle.fill': 'error-outline',
  'arrow.clockwise': 'refresh',
  plus: 'add',
  checkmark: 'check',
  'arrow.down.circle': 'file-download',
  'trash.fill': 'delete',
  'bolt.fill': 'flash-on',
  'arrow.triangle.2.circlepath.camera.fill': 'flip-camera-ios',
  'photo.on.rectangle': 'photo-library',
} satisfies Partial<IconMapping>;

/**
 * Иконка: нативные SF Symbols на iOS, Material Icons на Android и web.
 * Обеспечивает единообразный вид на платформах и оптимальный расход ресурсов.
 * Имена `name` основаны на SF Symbols и требуют ручного маппинга на Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
