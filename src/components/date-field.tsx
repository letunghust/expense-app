import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { formatDayHeader, fromISODate, toISODate } from '@/lib/dates';

/** Date input for a "YYYY-MM-DD" value: native dialog on Android, compact inline picker on iOS. */
export function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const theme = useTheme();
  const t = useStrings();

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={22} color={theme.textSecondary} />
        <ThemedText style={styles.text}>{t.common.date}</ThemedText>
        <DateTimePicker
          value={fromISODate(value)}
          mode="date"
          display="compact"
          locale="vi-VN"
          maximumDate={new Date(2100, 0, 1)}
          onValueChange={(_, date) => onChange(toISODate(date))}
        />
      </View>
    );
  }

  const open = () =>
    DateTimePickerAndroid.open({
      value: fromISODate(value),
      mode: 'date',
      onValueChange: (_, date) => onChange(toISODate(date)),
    });

  return (
    <Pressable onPress={open} style={styles.row}>
      <Ionicons name="calendar-outline" size={22} color={theme.textSecondary} />
      <ThemedText style={styles.text}>{formatDayHeader(value)}</ThemedText>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    flex: 1,
  },
});
