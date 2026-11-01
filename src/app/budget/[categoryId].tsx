import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDbQuery, useNotifyDataChanged } from '@/db/data-context';
import { listBudgets, setBudget } from '@/db/repo';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { categoryLabel } from '@/i18n/defaults';
import { currentYearMonth, monthRange } from '@/lib/dates';
import { showMessage } from '@/lib/dialog';
import { formatAmountInput, formatVND, groupDigits, parseAmount } from '@/lib/money';

export default function BudgetFormScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const db = useSQLiteContext();
  const notifyChanged = useNotifyDataChanged();
  const theme = useTheme();
  const t = useStrings();
  const [editedAmount, setAmountText] = useState<string>();

  const row = useDbQuery(
    async (db) => (await listBudgets(db, monthRange(currentYearMonth()))).find((r) => r.categoryId === Number(categoryId)),
    [categoryId]
  );
  // Shows the saved limit until the user starts typing.
  const amountText = editedAmount ?? (row?.limit ? groupDigits(row.limit) : '');

  const save = async (amount: number | null) => {
    await setBudget(db, Number(categoryId), amount);
    notifyChanged();
    router.back();
  };

  const onSave = () => {
    const amount = parseAmount(amountText);
    if (amount == null) {
      showMessage(t.budgets.missingAmount, t.budgets.missingAmountMessage);
      return;
    }
    save(amount);
  };

  if (!row) return <ThemedView style={styles.screen} />;

  return (
    <ThemedView style={[styles.screen, styles.content]}>
      <View style={styles.header}>
        <CategoryIcon icon={row.icon} color={row.color} size={48} />
        <View>
          <ThemedText type="smallBold">{categoryLabel(row.name)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t.budgets.spentThisMonth(formatVND(row.spent))}
          </ThemedText>
        </View>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {t.budgets.monthlyLimit}
      </ThemedText>
      <View style={[styles.amountBox, { borderBottomColor: theme.tint }]}>
        <TextInput
          value={amountText}
          onChangeText={(text) => setAmountText(formatAmountInput(text))}
          placeholder="0"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          autoFocus
          style={[styles.amountInput, { color: theme.text }]}
          accessibilityLabel={t.budgets.limit}
        />
        <ThemedText style={styles.currency}>₫</ThemedText>
      </View>

      <Pressable onPress={onSave} style={[styles.button, { backgroundColor: theme.tint }]}>
        <ThemedText type="smallBold" style={{ color: theme.onTint }}>
          {t.budgets.save}
        </ThemedText>
      </Pressable>
      {row.limit != null && (
        <Pressable onPress={() => save(null)} style={styles.button}>
          <ThemedText type="smallBold" themeColor="expense">
            {t.budgets.remove}
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  amountInput: {
    flex: 1,
    minWidth: 0, // web: <input> otherwise keeps its default intrinsic width and overflows
    fontSize: 32,
    fontWeight: 700,
    paddingVertical: Spacing.two,
  },
  currency: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: 700,
  },
  button: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
});
