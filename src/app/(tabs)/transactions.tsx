import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { AddTransactionButton } from '@/components/fab';
import { MonthSwitcher } from '@/components/month-switcher';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionItem } from '@/components/transaction-item';
import { Spacing } from '@/constants/theme';
import { useDbQuery } from '@/db/data-context';
import { getCategory, listTransactions } from '@/db/repo';
import type { TransactionRow, TransactionType } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { categoryLabel } from '@/i18n/defaults';
import { currentYearMonth, formatDayHeader, monthRange, type YearMonth } from '@/lib/dates';
import { formatSignedVND, formatVND } from '@/lib/money';

type TypeFilter = 'all' | TransactionType;

type Section = { title: string; net: number; data: TransactionRow[] };

/** Groups rows (already sorted newest first) into one section per day. */
function groupByDay(rows: TransactionRow[]): Section[] {
  const sections: Section[] = [];
  for (const row of rows) {
    let section = sections.at(-1);
    if (!section || section.title !== row.date) {
      section = { title: row.date, net: 0, data: [] };
      sections.push(section);
    }
    section.data.push(row);
    section.net += row.type === 'income' ? row.amount : -row.amount;
  }
  return sections;
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const t = useStrings();
  // Set by the overview screen when the user taps a category or "Xem tất cả".
  const params = useLocalSearchParams<{ year?: string; month?: string; categoryId?: string }>();

  const [month, setMonth] = useState<YearMonth>(currentYearMonth());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryId, setCategoryId] = useState<number>();
  const [search, setSearch] = useState('');

  // Apply new navigation params once, during render, so the user can still change filters afterwards.
  const paramsKey = `${params.year}|${params.month}|${params.categoryId}`;
  const [appliedParamsKey, setAppliedParamsKey] = useState<string>();
  if (paramsKey !== appliedParamsKey) {
    setAppliedParamsKey(paramsKey);
    if (params.year && params.month) setMonth({ year: Number(params.year), month: Number(params.month) });
    setCategoryId(params.categoryId ? Number(params.categoryId) : undefined);
  }

  const range = monthRange(month);
  const rows = useDbQuery(
    (db) =>
      listTransactions(db, {
        ...range,
        type: typeFilter === 'all' ? undefined : typeFilter,
        categoryId,
        search,
      }),
    [range.start, typeFilter, categoryId, search]
  );
  const category = useDbQuery((db) => (categoryId ? getCategory(db, categoryId) : Promise.resolve(null)), [categoryId]);

  const income = rows?.reduce((sum, r) => (r.type === 'income' ? sum + r.amount : sum), 0) ?? 0;
  const expense = rows?.reduce((sum, r) => (r.type === 'expense' ? sum + r.amount : sum), 0) ?? 0;
  const isFiltered = typeFilter !== 'all' || categoryId != null || search.trim() !== '';

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <MonthSwitcher value={month} onChange={setMonth} />
        <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.transactions.searchPlaceholder}
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
          />
          {search !== '' && (
            <Pressable hitSlop={8} onPress={() => setSearch('')} accessibilityLabel={t.transactions.clearSearch}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
        <View style={styles.chips}>
          <Chip label={t.common.all} selected={typeFilter === 'all'} onPress={() => setTypeFilter('all')} />
          <Chip label={t.common.expense} selected={typeFilter === 'expense'} onPress={() => setTypeFilter('expense')} />
          <Chip label={t.common.income} selected={typeFilter === 'income'} onPress={() => setTypeFilter('income')} />
          {category && (
            <Pressable
              onPress={() => setCategoryId(undefined)}
              style={[styles.categoryChip, { backgroundColor: theme.tint }]}>
              <ThemedText type="small" style={{ color: theme.onTint }} numberOfLines={1}>
                {categoryLabel(category.name)}
              </ThemedText>
              <Ionicons name="close" size={14} color={theme.onTint} />
            </Pressable>
          )}
        </View>
        <View style={styles.totals}>
          <ThemedText type="small" themeColor="income">
            {t.transactions.incomeTotal(formatVND(income))}
          </ThemedText>
          <ThemedText type="small" themeColor="expense">
            {t.transactions.expenseTotal(formatVND(expense))}
          </ThemedText>
        </View>
      </View>

      <SectionList
        sections={rows ? groupByDay(rows) : []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <ThemedView style={[styles.sectionHeader, { borderBottomColor: theme.border }]}>
            <ThemedText type="smallBold">{formatDayHeader(section.title)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatSignedVND(Math.abs(section.net), section.net >= 0 ? 'income' : 'expense')}
            </ThemedText>
          </ThemedView>
        )}
        renderItem={({ item }) => (
          <TransactionItem
            item={item}
            onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          rows ? (
            isFiltered ? (
              <EmptyState icon="search" title={t.transactions.noMatches} />
            ) : (
              <EmptyState
                icon="receipt-outline"
                title={t.transactions.emptyMonth}
                message={t.transactions.emptyMonthHint}
              />
            )
          ) : undefined
        }
      />
      <AddTransactionButton />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    minWidth: 0, // web: <input> otherwise keeps its default intrinsic width and overflows
    fontSize: 15,
    paddingVertical: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    maxWidth: 160,
  },
  totals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
