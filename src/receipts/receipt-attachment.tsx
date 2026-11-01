import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { showMessage } from '@/lib/dialog';

import { receiptUri } from './receipt-files';
import type { ScanResult } from './scan';

/** How the last scan went, shown under the attached image. */
export type ScanStatus = 'filled' | 'no-amount' | 'failed' | 'unsupported';

export function scanStatusOf(result: ScanResult): ScanStatus {
  if (!result.ocrAvailable) return 'unsupported';
  if (result.ocrFailed) return 'failed';
  return result.amount == null ? 'no-amount' : 'filled';
}

const STATUS_TEXT = {
  filled: 'filled',
  'no-amount': 'noAmount',
  failed: 'failed',
  unsupported: 'unsupported',
} as const satisfies Record<ScanStatus, string>;

/**
 * "Scan a transfer screenshot" button, or the attached image with buttons to
 * view, replace or remove it.
 */
export function ReceiptAttachment({
  receipt,
  status,
  ocrText,
  scanning,
  onScan,
  onView,
  onRemove,
}: {
  receipt: string | null;
  status?: ScanStatus;
  /** What OCR read from the image, viewable to check misreads. */
  ocrText?: string;
  scanning: boolean;
  onScan: () => void;
  onView: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const t = useStrings();

  if (!receipt) {
    return (
      <Pressable
        onPress={onScan}
        disabled={scanning}
        style={({ pressed }) => [styles.scanButton, { borderColor: theme.tint }, pressed && styles.pressed]}>
        {scanning ? <ActivityIndicator color={theme.tint} /> : <Ionicons name="scan-outline" size={26} color={theme.tint} />}
        <View style={styles.text}>
          <ThemedText type="smallBold" style={{ color: theme.tint }}>
            {scanning ? t.receipt.scanning : t.receipt.scan}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t.receipt.scanHint}
          </ThemedText>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.attached, { backgroundColor: theme.backgroundElement }]}>
      <Pressable onPress={onView} accessibilityLabel={t.receipt.view}>
        <Image source={{ uri: receiptUri(receipt) }} style={styles.thumbnail} contentFit="cover" />
      </Pressable>
      <Pressable onPress={onView} style={styles.text}>
        <ThemedText type="smallBold">{t.receipt.image}</ThemedText>
        <ThemedText
          type="small"
          themeColor={status === 'no-amount' || status === 'failed' ? 'warning' : 'textSecondary'}>
          {status ? t.receipt[STATUS_TEXT[status]] : t.receipt.tapToView}
        </ThemedText>
        {ocrText != null && status !== 'unsupported' && (
          <ThemedText
            type="small"
            style={{ color: theme.tint }}
            onPress={() => showMessage(t.receipt.ocrTitle, ocrText || t.receipt.ocrEmpty)}>
            {t.receipt.showOcr}
          </ThemedText>
        )}
      </Pressable>
      {scanning ? (
        <ActivityIndicator color={theme.tint} />
      ) : (
        <Pressable onPress={onScan} hitSlop={8} accessibilityLabel={t.receipt.pickAnother}>
          <Ionicons name="refresh" size={22} color={theme.textSecondary} />
        </Pressable>
      )}
      <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={t.receipt.remove}>
        <Ionicons name="close-circle" size={24} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  attached: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
