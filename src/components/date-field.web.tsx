import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';

/** Web version of DateField: the native date pickers don't exist on web, so use the browser's date input. */
export function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const theme = useTheme();
  const t = useStrings();
  return (
    <View style={styles.row}>
      <Ionicons name="calendar-outline" size={22} color={theme.textSecondary} />
      <ThemedText style={styles.text}>{t.common.date}</ThemedText>
      <input
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{
          fontSize: 16,
          padding: 6,
          borderRadius: 8,
          border: `1px solid ${theme.border}`,
          color: theme.text,
          background: theme.backgroundElement,
          colorScheme: 'light dark',
        }}
      />
    </View>
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
