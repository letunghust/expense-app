import Ionicons from '@expo/vector-icons/Ionicons';
import { Component, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors } from '@/constants/theme';

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
  const colors = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const advice =
    Platform.OS === 'web'
      ? 'Trình duyệt này không lưu được dữ liệu của ứng dụng. Trên iPhone cần iOS 17 trở lên: mở link bằng Safari (không dùng chế độ Riêng tư hay trình duyệt trong Zalo/Facebook), rồi chọn "Thêm vào Màn hình chính".'
      : 'Không mở được dữ liệu của ứng dụng. Hãy thử đóng hẳn ứng dụng rồi mở lại.';
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Ionicons name="alert-circle-outline" size={56} color={colors.warning} />
      <Text style={[styles.title, { color: colors.text }]}>Không mở được dữ liệu</Text>
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
