import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AddTransactionButton } from '@/components/fab';
import { Card } from '@/components/card';
import { CategoryIcon } from '@/components/category-icon';
import { DailyBarChart } from '@/components/daily-bar-chart';
import { DonutChart } from '@/components/donut-chart';
import { EmptyState } from '@/components/empty-state';
import { MonthSwitcher } from '@/components/month-switcher';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionItem } from '@/components/transaction-item';
import { Spacing } from '@/constants/theme';
import { useDbQuery } from '@/db/data-context';
import {
  getDailyExpenses,
  getSummary,
  getTotalBalance,
  getTotalsByCategory,
  listRecentTransactions,
} from '@/db/repo';
import { currentYearMonth, daysInMonth, monthRange } from '@/lib/dates';
import { formatCompactVND, formatVND } from '@/lib/money';

const RECENT_COUNT = 5;

export default function OverviewScreen() {
  const [month, setMonth] = useState(currentYearMonth());
  const range = monthRange(month);

  const data = useDbQuery(
    async (db) => {
      const [summary, byCategory, daily, balance, recent] = await Promise.all([
        getSummary(db, range),
        getTotalsByCategory(db, range, 'expense'),
        getDailyExpenses(db, range),
        getTotalBalance(db),
        listRecentTransactions(db, RECENT_COUNT),
      ]);
      const dailyTotals = new Array<number>(daysInMonth(month)).fill(0);
      for (const row of daily) dailyTotals[Number(row.date.slice(8, 10)) - 1] = row.total;
      return { summary, byCategory, dailyTotals, balance, recent };
    },
    [range.start]
  );

  const openTransactions = (categoryId?: number) =>
    router.navigate({
      pathname: '/transactions',
      params: { year: month.year, month: month.month, categoryId: categoryId ?? '' },
    });

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <MonthSwitcher value={month} onChange={setMonth} />

        {data && (
          <>
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Tổng số dư các ví
              </ThemedText>
              <ThemedText style={styles.balance}>{formatVND(data.balance)}</ThemedText>
              <View style={styles.summaryRow}>
                <SummaryCell label="Thu nhập" value={data.summary.income} color="income" />
                <SummaryCell label="Chi tiêu" value={data.summary.expense} color="expense" />
                <SummaryCell
                  label="Chênh lệch"
                  value={data.summary.income - data.summary.expense}
                  color={data.summary.income >= data.summary.expense ? 'income' : 'expense'}
                />
              </View>
            </Card>

            <Card>
              <ThemedText type="smallBold">Chi tiêu theo danh mục</ThemedText>
              {data.byCategory.length === 0 ? (
                <EmptyState icon="pie-chart-outline" title="Chưa có khoản chi nào trong tháng" />
              ) : (
                <>
                  <View style={styles.donut}>
                    <DonutChart
                      segments={data.byCategory.map((c) => ({ key: c.categoryId, value: c.total, color: c.color }))}
                      centerLabel="Tổng chi"
                      centerValue={formatCompactVND(data.summary.expense)}
                    />
                  </View>
                  {data.byCategory.map((c) => (
                    <Pressable key={c.categoryId} style={styles.legendRow} onPress={() => openTransactions(c.categoryId)}>
                      <CategoryIcon icon={c.icon} color={c.color} size={32} />
                      <ThemedText style={styles.flex} numberOfLines={1}>
                        {c.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {Math.round((c.total / data.summary.expense) * 100)}%
                      </ThemedText>
                      <ThemedText type="smallBold" style={styles.legendAmount}>
                        {formatVND(c.total)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </>
              )}
            </Card>

            <Card>
              <ThemedText type="smallBold">Chi tiêu theo ngày</ThemedText>
              <DailyBarChart totals={data.dailyTotals} />
            </Card>

            <Card>
              <View style={styles.cardHeader}>
                <ThemedText type="smallBold">Giao dịch gần đây</ThemedText>
                {data.recent.length > 0 && (
                  <Pressable hitSlop={8} onPress={() => openTransactions()}>
                    <ThemedText type="small" themeColor="tint">
                      Xem tất cả
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              {data.recent.length === 0 ? (
                <EmptyState
                  icon="receipt-outline"
                  title="Chưa có giao dịch"
                  message="Bấm nút + để ghi khoản thu hoặc chi đầu tiên."
                />
              ) : (
                data.recent.map((item) => (
                  <TransactionItem
                    key={item.id}
                    item={item}
                    onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
                  />
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
      <AddTransactionButton />
    </ThemedView>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: number; color: 'income' | 'expense' }) {
  return (
    <View style={styles.flex}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor={color} numberOfLines={1} adjustsFontSizeToFit>
        {formatVND(value)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: 100,
    gap: Spacing.three,
  },
  balance: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 700,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  donut: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  legendAmount: {
    minWidth: 96,
    textAlign: 'right',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
