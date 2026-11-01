import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useStrings } from '@/i18n';

/** Shows an attached transfer screenshot full screen. */
export function ReceiptViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const t = useStrings();
  return (
    <Modal visible={uri != null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {uri && <Image source={{ uri }} style={styles.image} contentFit="contain" accessibilityLabel={t.receipt.image} />}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel={t.common.close}
          style={[styles.close, { top: insets.top + Spacing.two }]}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
  },
  image: {
    flex: 1,
  },
  close: {
    position: 'absolute',
    right: Spacing.three,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
