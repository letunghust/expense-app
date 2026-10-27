import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

export type IconName = keyof typeof Ionicons.glyphMap;

/** Coloured circle with an Ionicons glyph, used for categories and wallets. */
export function CategoryIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}26`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon as IconName} size={size * 0.5} color={color} />
    </View>
  );
}
