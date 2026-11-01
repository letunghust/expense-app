import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AddTransactionButton } from '@/components/fab';
import { Card } from '@/components/card';
import { BarChart, dayLabel } from '@/components/bar-chart';
import { CategoryIcon } from '@/components/category-icon';
import { Chip } from '@/components/chip';
import { DonutChart } from '@/components/donut-chart';
import { EmptyState } from '@/components/empty-state';
import { MonthSwitcher, YearSwitcher } from '@/components/month-switcher';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionItem } from '@/components/transaction-item';
import { Spacing } from '@/constants/theme';
import { useDbQuery } from '@/db/data-context';
import {
  getDailyExpenses,
  getMonthlyExpenses,
  getSummary,
  getTotalBalance,
  getTotalsByCategory,
  listRecentTransactions,
} from '@/db/repo';
import { useStrings } from '@/i18n';
import { categoryLabel } from '@/i18n/defaults';
import { currentYearMonth, daysInMonth, monthRange, yearRange } from '@/lib/dates';
import { formatCompactVND, formatVND } from '@/lib/money';

const RECENT_COUNT = 5;
const monthLabel = (i: number) => String(i + 1);

type Period = 'month' | 'year';

export default function OverviewScreen() {
  const t = useStrings();
  const [period, setPeriod] = useState<Period>('month');
  // The year view shows `month.year`, so switching back to the month view keeps the month.
  const [month, setMonth] = useState(currentYearMonth());
  const isYear = period === 'year';
  const range = isYear ? yearRange(month.year) : monthRange(month);

  const data = useDbQuery(
    async (db) => {
      const [summary, byCategory, bars, balance, recent] = await Promise.all([
        getSummary(db, range),
        getTotalsByCategory(db, range, 'expense'),
        isYear ? getMonthlyExpenses(db, range) : getDailyExpenses(db, range),
        getTotalBalance(db),
        listRecentTransactions(db, RECENT_COUNT),
      ]);
      // One bar per month of the year, or per day of the month; keys are "YYYY-MM" or "YYYY-MM-DD".
      const barTotals = new Array<number>(isYear ? 12 : daysInMonth(month)).fill(0);
      for (const row of bars) {
        const key = 'month' in row ? row.month.slice(5, 7) : row.date.slice(8, 10);
        barTotals[Number(key) - 1] = row.total;
      }
      return { summary, byCategory, barTotals, balance, recent };
    },
    [range.start, range.end]
  );

  const openTransactions = (categoryId?: number) =>
    router.navigate({
      pathname: '/transactions',
      params: { year: month.year, month: month.month, categoryId: categoryId ?? '' },
    });

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.periods}>
          <Chip label={t.home.periodMonth} selected={!isYear} onPress={() => setPeriod('month')} />
          <Chip label={t.home.periodYear} selected={isYear} onPress={() => setPeriod('year')} />
        </View>
        {isYear ? (
          <YearSwitcher value={month.year} onChange={(year) => setMonth({ ...month, year })} />
        ) : (
          <MonthSwitcher value={month} onChange={setMonth} />
        )}

        {data && (
          <>
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                {t.home.totalBalance}
              </ThemedText>
              <ThemedText style={styles.balance}>{formatVND(data.balance)}</ThemedText>
              <View style={styles.summaryRow}>
                <SummaryCell label={t.common.income} value={data.summary.income} color="income" />
                <SummaryCell label={t.common.expense} value={data.summary.expense} color="expense" />
                <SummaryCell
                  label={t.home.net}
                  value={data.summary.income - data.summary.expense}
                  color={data.summary.income >= data.summary.expense ? 'income' : 'expense'}
                />
              </View>
            </Card>

            <Card>
              <ThemedText type="smallBold">{t.home.byCategory}</ThemedText>
              {data.byCategory.length === 0 ? (
                <EmptyState icon="pie-chart-outline" title={isYear ? t.home.noExpensesYear : t.home.noExpenses} />
              ) : (
                <>
                  <View style={styles.donut}>
                    <DonutChart
                      segments={data.byCategory.map((c) => ({ key: c.categoryId, value: c.total, color: c.color }))}
                      centerLabel={t.home.totalSpent}
                      centerValue={formatCompactVND(data.summary.expense)}
                    />
                  </View>
                  {data.byCategory.map((c) => (
                    // The transactions screen lists one month at a time, so only the month view links there.
                    <Pressable
                      key={c.categoryId}
                      style={styles.legendRow}
                      disabled={isYear}
                      onPress={() => openTransactions(c.categoryId)}>
                      <CategoryIcon icon={c.icon} color={c.color} size={32} />
                      <ThemedText style={styles.flex} numberOfLines={1}>
                        {categoryLabel(c.name)}
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
              <ThemedText type="smallBold">{isYear ? t.home.byMonth : t.home.byDay}</ThemedText>
              {isYear ? (
                <BarChart
                  totals={data.barTotals}
                  labelFor={monthLabel}
                  onPressBar={(i) => {
                    setMonth({ year: month.year, month: i + 1 });
                    setPeriod('month');
                  }}
                />
              ) : (
                <BarChart totals={data.barTotals} labelFor={dayLabel} />
              )}
            </Card>

            <Card>
              <View style={styles.cardHeader}>
                <ThemedText type="smallBold">{t.home.recent}</ThemedText>
                {data.recent.length > 0 && (
                  <Pressable hitSlop={8} onPress={() => openTransactions()}>
                    <ThemedText type="small" themeColor="tint">
                      {t.home.seeAll}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              {data.recent.length === 0 ? (
                <EmptyState
                  icon="receipt-outline"
                  title={t.home.noTransactions}
                  message={t.home.noTransactionsHint}
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
  periods: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
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
