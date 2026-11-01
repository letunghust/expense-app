import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { showMessage } from '@/lib/dialog';
import { scanTransferReceipt, stashScan } from '@/receipts/scan';

/**
 * Floating buttons: "+" opens the new transaction form, the smaller one above
 * it reads a transfer screenshot first and opens the form filled in.
 */
export function AddTransactionButton() {
  const theme = useTheme();
  const t = useStrings();
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    setScanning(true);
    try {
      const result = await scanTransferReceipt();
      if (result) router.push({ pathname: '/transaction/[id]', params: { id: 'new', scan: stashScan(result) } });
    } catch (error) {
      console.error(error);
      showMessage(t.common.error, t.transaction.imageOpenFailed);
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        accessibilityLabel={t.fab.scan}
        onPress={scan}
        disabled={scanning}
        style={({ pressed }) => [
          styles.button,
          styles.small,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        {scanning ? <ActivityIndicator color={theme.tint} /> : <Ionicons name="scan-outline" size={24} color={theme.tint} />}
      </Pressable>
      <Pressable
        accessibilityLabel={t.fab.add}
        onPress={() => router.push('/transaction/new')}
        style={({ pressed }) => [styles.button, styles.large, { backgroundColor: theme.tint }, pressed && styles.pressed]}>
        <Ionicons name="add" size={32} color={theme.onTint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    alignItems: 'center',
    gap: 14,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  large: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  small: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.8,
  },
});
