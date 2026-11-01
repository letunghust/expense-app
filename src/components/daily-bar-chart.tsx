import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { formatCompactVND } from '@/lib/money';

const LABELLED_DAYS = new Set([1, 5, 10, 15, 20, 25]);

/** One bar per day of the month; `totals[i]` is the spending on day i + 1. */
export function DailyBarChart({ totals, height = 120 }: { totals: number[]; height?: number }) {
  const theme = useTheme();
  const t = useStrings();
  const max = Math.max(...totals, 0);
  const lastDay = totals.length;

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.max}>
        {max > 0 ? t.home.highest(formatCompactVND(max)) : ' '}
      </ThemedText>
      <View style={[styles.bars, { height }]}>
        {totals.map((total, i) => (
          <View key={i} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                {
                  height: max > 0 ? Math.max((total / max) * height, total > 0 ? 2 : 0) : 0,
                  backgroundColor: theme.expense,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {totals.map((_, i) => (
          <View key={i} style={styles.labelSlot}>
            {(LABELLED_DAYS.has(i + 1) || i + 1 === lastDay) && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                {i + 1}
              </ThemedText>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  max: {
    fontSize: 12,
    lineHeight: 16,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barSlot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  labels: {
    flexDirection: 'row',
    gap: 2,
  },
  labelSlot: {
    flex: 1,
    alignItems: 'center',
    overflow: 'visible',
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    width: 20,
    textAlign: 'center',
  },
});
