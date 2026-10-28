import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { receiptUri } from './receipt-files';
import type { ScanResult } from './scan';

/** How the last scan went, shown under the attached image. */
export type ScanStatus = 'filled' | 'no-amount' | 'unsupported';

export function scanStatusOf(result: ScanResult): ScanStatus {
  if (!result.ocrAvailable) return 'unsupported';
  return result.amount == null ? 'no-amount' : 'filled';
}

const STATUS_TEXT: Record<ScanStatus, string> = {
  filled: 'Đã tự điền từ ảnh. Kiểm tra lại trước khi lưu.',
  'no-amount': 'Không đọc được số tiền, vui lòng nhập tay.',
  unsupported: 'Bản xem trước trên web không đọc được chữ trong ảnh, hãy nhập tay.',
};

/**
 * "Scan a transfer screenshot" button, or the attached image with buttons to
 * view, replace or remove it.
 */
export function ReceiptAttachment({
  receipt,
  status,
  scanning,
  onScan,
  onView,
  onRemove,
}: {
  receipt: string | null;
  status?: ScanStatus;
  scanning: boolean;
  onScan: () => void;
  onView: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();

  if (!receipt) {
    return (
      <Pressable
        onPress={onScan}
        disabled={scanning}
        style={({ pressed }) => [styles.scanButton, { borderColor: theme.tint }, pressed && styles.pressed]}>
        {scanning ? <ActivityIndicator color={theme.tint} /> : <Ionicons name="scan-outline" size={26} color={theme.tint} />}
        <View style={styles.text}>
          <ThemedText type="smallBold" style={{ color: theme.tint }}>
            {scanning ? 'Đang đọc ảnh…' : 'Quét ảnh chuyển khoản'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tự điền số tiền, ngày và nội dung từ ảnh chụp màn hình
          </ThemedText>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.attached, { backgroundColor: theme.backgroundElement }]}>
      <Pressable onPress={onView} accessibilityLabel="Xem ảnh chuyển khoản">
        <Image source={{ uri: receiptUri(receipt) }} style={styles.thumbnail} contentFit="cover" />
      </Pressable>
      <Pressable onPress={onView} style={styles.text}>
        <ThemedText type="smallBold">Ảnh chuyển khoản</ThemedText>
        <ThemedText type="small" themeColor={status === 'no-amount' ? 'warning' : 'textSecondary'}>
          {status ? STATUS_TEXT[status] : 'Chạm để xem ảnh'}
        </ThemedText>
      </Pressable>
      {scanning ? (
        <ActivityIndicator color={theme.tint} />
      ) : (
        <Pressable onPress={onScan} hitSlop={8} accessibilityLabel="Chọn ảnh khác">
          <Ionicons name="refresh" size={22} color={theme.textSecondary} />
        </Pressable>
      )}
      <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Gỡ ảnh">
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
