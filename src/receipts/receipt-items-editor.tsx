import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { categoryLabel } from '@/i18n/defaults';
import { formatAmountInput, formatVND, groupDigits, parseAmount } from '@/lib/money';
import type { ReceiptItem } from '@/lib/receipt-parser';

/** One product of a scanned receipt while it is being checked; saved as its own transaction. */
export type EditableItem = {
  key: number;
  name: string;
  amountText: string;
  categoryId?: number;
  /** Suggested by the scan, used until the user picks a category. */
  categoryHint?: string;
};

export function toEditableItems(items: ReceiptItem[]): EditableItem[] {
  return items.map((item, key) => ({
    key,
    name: item.name,
    amountText: item.amount ? groupDigits(item.amount) : '',
    categoryHint: item.categoryHint,
  }));
}

export function itemCategoryId(item: EditableItem, categories: Category[]): number | undefined {
  return item.categoryId ?? categories.find((c) => c.name === item.categoryHint)?.id;
}

/** The products of a scanned receipt, to correct before each is saved as a transaction. */
export function ReceiptItemsEditor({
  items,
  categories,
  scannedTotal,
  onChange,
  onMerge,
}: {
  items: EditableItem[];
  /** Expense categories to choose from. */
  categories: Category[];
  /** The total printed on the receipt, to compare with the sum of the items. */
  scannedTotal?: number;
  onChange: (items: EditableItem[]) => void;
  /** Go back to saving the whole receipt as one transaction. */
  onMerge: () => void;
}) {
  const t = useStrings();
  const theme = useTheme();
  const [pickingCategoryOf, setPickingCategoryOf] = useState<number>();

  const update = (key: number, change: Partial<EditableItem>) =>
    onChange(items.map((item) => (item.key === key ? { ...item, ...change } : item)));
  const add = () => {
    const key = Math.max(-1, ...items.map((item) => item.key)) + 1;
    onChange([...items, { key, name: '', amountText: '' }]);
  };

  const sum = items.reduce((total, item) => total + (parseAmount(item.amountText) ?? 0), 0);

  return (
    <View style={styles.editor}>
      <View>
        <ThemedText type="smallBold">{t.receipt.itemsTitle(items.length)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t.receipt.itemsHint}
        </ThemedText>
      </View>

      {items.map((item) => {
        const category = categories.find((c) => c.id === itemCategoryId(item, categories));
        const picking = pickingCategoryOf === item.key;
        return (
          <View key={item.key} style={[styles.item, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.row}>
              <TextInput
                value={item.name}
                onChangeText={(name) => update(item.key, { name })}
                placeholder={t.receipt.itemName}
                placeholderTextColor={theme.textSecondary}
                maxLength={120}
                style={[styles.name, { color: theme.text }]}
              />
              <Pressable
                hitSlop={8}
                onPress={() => onChange(items.filter((other) => other.key !== item.key))}
                accessibilityLabel={t.receipt.removeItem}>
                <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.row}>
              <Pressable
                onPress={() => setPickingCategoryOf(picking ? undefined : item.key)}
                accessibilityLabel={t.transaction.category}
                style={styles.category}>
                <CategoryIcon icon={category?.icon ?? 'help'} color={category?.color ?? theme.textSecondary} size={28} />
                <ThemedText type="small" numberOfLines={1} style={styles.categoryName}>
                  {category ? categoryLabel(category.name) : t.transaction.category}
                </ThemedText>
                <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
              </Pressable>
              <TextInput
                value={item.amountText}
                onChangeText={(text) => update(item.key, { amountText: formatAmountInput(text) })}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                accessibilityLabel={t.transaction.amount}
                style={[styles.amount, { color: theme.expense }]}
              />
              <ThemedText type="smallBold" style={{ color: theme.expense }}>
                ₫
              </ThemedText>
            </View>
            {picking && (
              <View style={styles.chips}>
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    label={categoryLabel(c.name)}
                    selected={c.id === category?.id}
                    onPress={() => {
                      update(item.key, { categoryId: c.id });
                      setPickingCategoryOf(undefined);
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}

      <Pressable onPress={add} style={styles.link}>
        <Ionicons name="add-circle-outline" size={20} color={theme.tint} />
        <ThemedText type="smallBold" style={{ color: theme.tint }}>
          {t.receipt.addItem}
        </ThemedText>
      </Pressable>

      <View style={[styles.totals, { borderTopColor: theme.border }]}>
        <ThemedText type="smallBold">{t.receipt.itemsTotal(formatVND(sum))}</ThemedText>
        {scannedTotal != null && scannedTotal !== sum && (
          <ThemedText type="small" style={{ color: theme.expense }}>
            {t.receipt.receiptTotal(formatVND(scannedTotal))}
          </ThemedText>
        )}
      </View>

      <Pressable onPress={onMerge} style={styles.link}>
        <Ionicons name="git-merge-outline" size={20} color={theme.tint} />
        <ThemedText type="smallBold" style={{ color: theme.tint }}>
          {t.receipt.mergeItems}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    gap: Spacing.two,
  },
  item: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    flex: 1,
    minWidth: 0, // web: <input> otherwise keeps its default intrinsic width and overflows
    fontSize: 15,
    paddingVertical: Spacing.one,
  },
  category: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  categoryName: {
    flexShrink: 1,
  },
  amount: {
    width: 110,
    textAlign: 'right',
    fontSize: 17,
    fontWeight: 700,
    paddingVertical: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  totals: {
    gap: 2,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
