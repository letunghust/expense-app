import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TransactionRow } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { categoryLabel, walletLabel } from '@/i18n/defaults';
import { formatSignedVND } from '@/lib/money';

export function TransactionItem({ item, onPress }: { item: TransactionRow; onPress: () => void }) {
  const theme = useTheme();
  const t = useStrings();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <CategoryIcon icon={item.categoryIcon} color={item.categoryColor} />
      <View style={styles.middle}>
        <ThemedText numberOfLines={1}>{categoryLabel(item.categoryName)}</ThemedText>
        <View style={styles.subtitle}>
          {item.receipt && (
            <Ionicons name="image-outline" size={14} color={theme.textSecondary} accessibilityLabel={t.transactions.hasReceipt} />
          )}
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.subtitleText}>
            {item.note ? `${item.note} · ${walletLabel(item.walletName)}` : walletLabel(item.walletName)}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="smallBold" themeColor={item.type} style={styles.amount}>
        {formatSignedVND(item.amount, item.type)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  middle: {
    flex: 1,
  },
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subtitleText: {
    flexShrink: 1,
  },
  amount: {
    fontSize: 15,
  },
});
