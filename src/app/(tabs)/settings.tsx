import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import type { IconName } from '@/components/category-icon';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useNotifyDataChanged } from '@/db/data-context';
import { deleteAllTransactions, listAllTransactions } from '@/db/repo';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, todayISO } from '@/lib/dates';
import { toCsv } from '@/lib/csv';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const notifyChanged = useNotifyDataChanged();

  const exportCsv = async () => {
    try {
      const rows = await listAllTransactions(db);
      if (rows.length === 0) {
        Alert.alert('Chưa có dữ liệu', 'Bạn chưa có giao dịch nào để xuất.');
        return;
      }
      const csv = toCsv(
        ['Ngày', 'Loại', 'Danh mục', 'Ví', 'Số tiền', 'Ghi chú'],
        rows.map((r) => [
          formatDate(r.date),
          r.type === 'income' ? 'Thu nhập' : 'Chi tiêu',
          r.categoryName,
          r.walletName,
          r.amount,
          r.note,
        ])
      );
      const file = new File(Paths.cache, `chi-tieu-${todayISO()}.csv`);
      if (file.exists) file.delete();
      file.create();
      await file.write(csv);

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Không thể chia sẻ', 'Thiết bị này không hỗ trợ chia sẻ tệp.');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Xuất dữ liệu chi tiêu',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không xuất được tệp CSV.');
    }
  };

  const confirmDeleteAll = () =>
    Alert.alert(
      'Xóa toàn bộ giao dịch?',
      'Tất cả giao dịch sẽ bị xóa vĩnh viễn. Ví, danh mục và ngân sách vẫn được giữ lại. Nên xuất CSV để sao lưu trước.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa tất cả',
          style: 'destructive',
          onPress: async () => {
            await deleteAllTransactions(db);
            notifyChanged();
          },
        },
      ]
    );

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.group}>
          <SettingsRow icon="wallet-outline" label="Quản lý ví" onPress={() => router.push('/wallets')} />
          <SettingsRow icon="pricetags-outline" label="Quản lý danh mục" onPress={() => router.push('/categories')} />
        </Card>

        <Card style={styles.group}>
          <SettingsRow icon="download-outline" label="Xuất dữ liệu ra CSV (Excel)" onPress={exportCsv} />
          <SettingsRow icon="trash-outline" label="Xóa toàn bộ giao dịch" destructive onPress={confirmDeleteAll} />
        </Card>

        <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
          Phiên bản {Constants.expoConfig?.version ?? '1.0.0'} · Dữ liệu được lưu trên điện thoại của bạn
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const theme = useTheme();
  const color = destructive ? theme.expense : theme.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={color} />
      <ThemedText style={[styles.label, { color }]}>{label}</ThemedText>
      {!destructive && <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  group: {
    paddingVertical: Spacing.one,
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    flex: 1,
  },
  footer: {
    textAlign: 'center',
  },
});
