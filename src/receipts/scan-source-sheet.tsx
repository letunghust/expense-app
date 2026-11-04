import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';

import type { ScanSource } from './scan';

/** Asks whether to take a photo or use an existing image. */
export function ScanSourceSheet({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  /** Called straight from the tap: browsers only open the camera or file picker from one. */
  onPick: (source: ScanSource) => void;
  onClose: () => void;
}) {
  const t = useStrings();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const options = [
    { source: 'camera', icon: 'camera-outline', label: t.receipt.takePhoto },
    { source: 'library', icon: 'images-outline', label: t.receipt.fromLibrary },
  ] as const;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={styles.outside} onPress={onClose} accessibilityLabel={t.common.cancel} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, Spacing.three) },
          ]}>
          {options.map(({ source, icon, label }) => (
            <Pressable
              key={source}
              onPress={() => onPick(source)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name={icon} size={24} color={theme.tint} />
              <ThemedText>{label}</ThemedText>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
            ]}>
            <ThemedText type="smallBold">{t.common.cancel}</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  outside: {
    flex: 1,
  },
  sheet: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: 14,
    borderRadius: 10,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: Spacing.two,
  },
});
