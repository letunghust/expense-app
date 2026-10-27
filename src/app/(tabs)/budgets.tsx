import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { CategoryIcon } from '@/components/category-icon';
import { MonthSwitcher } from '@/components/month-switcher';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDbQuery } from '@/db/data-context';
import { listBudgets } from '@/db/repo';
import type { BudgetRow } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { budgetStatus, type BudgetLevel } from '@/lib/budget';
import { currentYearMonth, monthRange } from '@/lib/dates';
import { formatVND } from '@/lib/money';

export default function BudgetsScreen() {
  const theme = useTheme();
  const [month, setMonth] = useState(currentYearMonth());
  const range = monthRange(month);
  const rows = useDbQuery((db) => listBudgets(db, range), [range.start]);

  const withBudget = rows?.filter((r): r is BudgetRow & { limit: number } => r.limit != null) ?? [];
  const withoutBudget = rows?.filter((r) => r.limit == null) ?? [];
  const totalLimit = withBudget.reduce((sum, r) => sum + r.limit, 0);
  const totalSpent = withBudget.reduce((sum, r) => sum + r.spent, 0);
  const total = budgetStatus(totalSpent, totalLimit);

  const levelColor = (level: BudgetLevel) =>
    level === 'over' ? theme.expense : level === 'warning' ? theme.warning : theme.income;

  const openBudget = (categoryId: number) =>
    router.push({ pathname: '/budget/[categoryId]', params: { categoryId } });

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <MonthSwitcher value={month} onChange={setMonth} />

        {rows && (
          <>
            <Card>
              {withBudget.length === 0 ? (
                <>
                  <ThemedText type="smallBold">Chưa đặt ngân sách</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Đặt hạn mức chi tiêu hằng tháng cho từng danh mục bên dưới. Ứng dụng sẽ cảnh báo khi bạn chi tới
                    80% hạn mức.
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    {total.remaining >= 0 ? 'Còn có thể chi' : 'Đã vượt ngân sách'}
                  </ThemedText>
                  <ThemedText style={[styles.bigNumber, { color: levelColor(total.level) }]}>
                    {formatVND(Math.abs(total.remaining))}
                  </ThemedText>
                  <ProgressBar ratio={total.ratio} color={levelColor(total.level)} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Đã chi {formatVND(totalSpent)} / {formatVND(totalLimit)}
                  </ThemedText>
                </>
              )}
            </Card>

            {withBudget.length > 0 && (
              <Card>
                <ThemedText type="smallBold">Theo danh mục</ThemedText>
                {withBudget.map((row) => {
                  const status = budgetStatus(row.spent, row.limit);
                  const color = levelColor(status.level);
                  return (
                    <Pressable key={row.categoryId} onPress={() => openBudget(row.categoryId)} style={styles.budgetRow}>
                      <View style={styles.rowHeader}>
                        <CategoryIcon icon={row.icon} color={row.color} size={32} />
                        <ThemedText style={styles.flex} numberOfLines={1}>
                          {row.name}
                        </ThemedText>
                        <ThemedText type="small" style={{ color }}>
                          {Math.round(status.ratio * 100)}%
                        </ThemedText>
                      </View>
                      <ProgressBar ratio={status.ratio} color={color} />
                      <View style={styles.rowFooter}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {formatVND(row.spent)} / {formatVND(row.limit)}
                        </ThemedText>
                        <ThemedText type="small" style={{ color }}>
                          {status.remaining >= 0
                            ? `Còn ${formatVND(status.remaining)}`
                            : `Vượt ${formatVND(-status.remaining)}`}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </Card>
            )}

            {withoutBudget.length > 0 && (
              <Card>
                <ThemedText type="smallBold">Chưa đặt hạn mức</ThemedText>
                {withoutBudget.map((row) => (
                  <Pressable key={row.categoryId} onPress={() => openBudget(row.categoryId)} style={styles.rowHeader}>
                    <CategoryIcon icon={row.icon} color={row.color} size={32} />
                    <View style={styles.flex}>
                      <ThemedText numberOfLines={1}>{row.name}</ThemedText>
                      {row.spent > 0 && (
                        <ThemedText type="small" themeColor="textSecondary">
                          Đã chi {formatVND(row.spent)}
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText type="small" themeColor="tint">
                      Đặt hạn mức
                    </ThemedText>
                  </Pressable>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
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
    paddingBottom: Spacing.five,
  },
  bigNumber: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 700,
  },
  budgetRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  rowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flex: {
    flex: 1,
  },
});
