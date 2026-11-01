import Ionicons from '@expo/vector-icons/Ionicons';
import { Component, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useStrings } from '@/i18n';

/**
 * Shown instead of a blank screen when the database can't be opened. On the
 * web this happens in browsers without the storage the database needs: older
 * iPhones (before iOS 17), some private-browsing modes, in-app browsers.
 */
export class DatabaseErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    return this.state.error ? <DatabaseError error={this.state.error} /> : this.props.children;
  }
}

function DatabaseError({ error }: { error: Error }) {
  const t = useStrings();
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const advice = Platform.OS === 'web' ? t.databaseError.web : t.databaseError.native;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Ionicons name="alert-circle-outline" size={56} color={colors.warning} />
      <Text style={[styles.title, { color: colors.text }]}>{t.databaseError.title}</Text>
      <Text style={[styles.body, { color: colors.text }]}>{advice}</Text>
      <Text style={[styles.detail, { color: colors.textSecondary }]} selectable>
        {error.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 420 },
  detail: { fontSize: 12, textAlign: 'center', maxWidth: 420 },
});
