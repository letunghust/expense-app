import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TransactionRow } from '@/db/types';
import { formatSignedVND } from '@/lib/money';

export function TransactionItem({ item, onPress }: { item: TransactionRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <CategoryIcon icon={item.categoryIcon} color={item.categoryColor} />
      <View style={styles.middle}>
        <ThemedText numberOfLines={1}>{item.categoryName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {item.note ? `${item.note} · ${item.walletName}` : item.walletName}
        </ThemedText>
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
  amount: {
    fontSize: 15,
  },
});
