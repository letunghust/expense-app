import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { formatCompactVND } from '@/lib/money';

const LABELLED_DAYS = new Set([1, 5, 10, 15, 20, 25]);

/** Day of the month under bar i, for a few days only so the labels fit. */
export const dayLabel = (i: number, count: number) => (LABELLED_DAYS.has(i + 1) || i + 1 === count ? String(i + 1) : null);

/**
 * Spending bars; `totals[i]` is bar i. `labelFor` returns the text under a bar (null for none),
 * `onPressBar` makes the bars tappable.
 */
export function BarChart({
  totals,
  labelFor,
  onPressBar,
  height = 120,
}: {
  totals: number[];
  labelFor: (i: number, count: number) => string | null;
  onPressBar?: (i: number) => void;
  height?: number;
}) {
  const theme = useTheme();
  const t = useStrings();
  const max = Math.max(...totals, 0);

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.max}>
        {max > 0 ? t.home.highest(formatCompactVND(max)) : ' '}
      </ThemedText>
      <View style={[styles.bars, { height }]}>
        {totals.map((total, i) => (
          <Pressable key={i} style={styles.barSlot} disabled={!onPressBar} onPress={() => onPressBar?.(i)}>
            <View
              style={[
                styles.bar,
                {
                  height: max > 0 ? Math.max((total / max) * height, total > 0 ? 2 : 0) : 0,
                  backgroundColor: theme.expense,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.labels}>
        {totals.map((_, i) => {
          const label = labelFor(i, totals.length);
          return (
            <View key={i} style={styles.labelSlot}>
              {label != null && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                  {label}
                </ThemedText>
              )}
            </View>
          );
        })}
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
    alignSelf: 'stretch',
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
