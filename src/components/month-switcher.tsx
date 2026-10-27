import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentYearMonth, formatMonth, isSameMonth, shiftMonth, type YearMonth } from '@/lib/dates';

/** "‹ Tháng 10/2026 ›" — tapping the label jumps back to the current month. */
export function MonthSwitcher({ value, onChange }: { value: YearMonth; onChange: (value: YearMonth) => void }) {
  const theme = useTheme();
  const isCurrent = isSameMonth(value, currentYearMonth());
  return (
    <View style={styles.row}>
      <Pressable hitSlop={12} onPress={() => onChange(shiftMonth(value, -1))} accessibilityLabel="Tháng trước">
        <Ionicons name="chevron-back" size={24} color={theme.text} />
      </Pressable>
      <Pressable onPress={() => onChange(currentYearMonth())} disabled={isCurrent}>
        <ThemedText type="smallBold" style={styles.label}>
          {formatMonth(value)}
        </ThemedText>
        {!isCurrent && (
          <ThemedText type="small" themeColor="tint" style={styles.hint}>
            Về tháng này
          </ThemedText>
        )}
      </Pressable>
      <Pressable hitSlop={12} onPress={() => onChange(shiftMonth(value, 1))} accessibilityLabel="Tháng sau">
        <Ionicons name="chevron-forward" size={24} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  label: {
    fontSize: 17,
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
});
