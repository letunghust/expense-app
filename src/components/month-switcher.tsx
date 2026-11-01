import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { currentYearMonth, formatMonth, formatYear, isSameMonth, shiftMonth, type YearMonth } from '@/lib/dates';

/** "‹ Tháng 10/2026 ›" — tapping the label jumps back to the current month. */
export function MonthSwitcher({ value, onChange }: { value: YearMonth; onChange: (value: YearMonth) => void }) {
  const t = useStrings();
  return (
    <Switcher
      label={formatMonth(value)}
      isCurrent={isSameMonth(value, currentYearMonth())}
      onPrevious={() => onChange(shiftMonth(value, -1))}
      onNext={() => onChange(shiftMonth(value, 1))}
      onCurrent={() => onChange(currentYearMonth())}
      previousLabel={t.month.previous}
      nextLabel={t.month.next}
      currentLabel={t.month.backToCurrent}
    />
  );
}

/** "‹ Năm 2026 ›" — tapping the label jumps back to the current year. */
export function YearSwitcher({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const t = useStrings();
  const currentYear = currentYearMonth().year;
  return (
    <Switcher
      label={formatYear(value)}
      isCurrent={value === currentYear}
      onPrevious={() => onChange(value - 1)}
      onNext={() => onChange(value + 1)}
      onCurrent={() => onChange(currentYear)}
      previousLabel={t.month.previousYear}
      nextLabel={t.month.nextYear}
      currentLabel={t.month.backToCurrentYear}
    />
  );
}

function Switcher(props: {
  label: string;
  isCurrent: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onCurrent: () => void;
  previousLabel: string;
  nextLabel: string;
  currentLabel: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable hitSlop={12} onPress={props.onPrevious} accessibilityLabel={props.previousLabel}>
        <Ionicons name="chevron-back" size={24} color={theme.text} />
      </Pressable>
      <Pressable onPress={props.onCurrent} disabled={props.isCurrent}>
        <ThemedText type="smallBold" style={styles.label}>
          {props.label}
        </ThemedText>
        {!props.isCurrent && (
          <ThemedText type="small" themeColor="tint" style={styles.hint}>
            {props.currentLabel}
          </ThemedText>
        )}
      </Pressable>
      <Pressable hitSlop={12} onPress={props.onNext} accessibilityLabel={props.nextLabel}>
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
