import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

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
import { confirmDestructive, showMessage } from '@/lib/dialog';
import { useAppLock } from '@/lock/app-lock-context';
import { authenticateWithBiometrics, type BiometricSupport, getBiometricSupport } from '@/lock/biometrics';
import { setBiometricsEnabled } from '@/lock/lock-store';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const notifyChanged = useNotifyDataChanged();

  const exportCsv = async () => {
    try {
      const rows = await listAllTransactions(db);
      if (rows.length === 0) {
        showMessage('Chưa có dữ liệu', 'Bạn chưa có giao dịch nào để xuất.');
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
      const fileName = `chi-tieu-${todayISO()}.csv`;
      if (Platform.OS === 'web') {
        // No share sheet in the browser: download the file instead.
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
        return;
      }
      const file = new File(Paths.cache, fileName);
      if (file.exists) file.delete();
      file.create();
      await file.write(csv);

      if (!(await Sharing.isAvailableAsync())) {
        showMessage('Không thể chia sẻ', 'Thiết bị này không hỗ trợ chia sẻ tệp.');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Xuất dữ liệu chi tiêu',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (error) {
      console.error(error);
      showMessage('Lỗi', 'Không xuất được tệp CSV.');
    }
  };

  const confirmDeleteAll = () =>
    confirmDestructive({
      title: 'Xóa toàn bộ giao dịch?',
      message:
        'Tất cả giao dịch sẽ bị xóa vĩnh viễn. Ví, danh mục và ngân sách vẫn được giữ lại. Nên xuất CSV để sao lưu trước.',
      confirmText: 'Xóa tất cả',
      onConfirm: async () => {
        await deleteAllTransactions(db);
        notifyChanged();
      },
    });

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <SecurityCard />

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

function SecurityCard() {
  const { settings, reload } = useAppLock();
  const [biometrics, setBiometrics] = useState<BiometricSupport>();

  useEffect(() => {
    getBiometricSupport().then(setBiometrics);
  }, []);

  const openPin = (mode: 'create' | 'change' | 'disable') =>
    router.push({ pathname: '/security/pin', params: { mode } });

  const toggleBiometrics = async (enabled: boolean) => {
    // Confirm the finger/face actually works before relying on it.
    if (enabled && !(await authenticateWithBiometrics(`Xác nhận ${biometrics?.label ?? 'vân tay'}`))) return;
    await setBiometricsEnabled(enabled);
    await reload();
  };

  const biometricLabel = biometrics?.label ?? 'vân tay';

  return (
    <Card style={styles.group}>
      <SwitchRow
        icon="lock-closed-outline"
        label="Khóa ứng dụng bằng mã PIN"
        value={settings.pinEnabled}
        onValueChange={(on) => openPin(on ? 'create' : 'disable')}
      />
      {settings.pinEnabled && (
        <>
          <SettingsRow icon="keypad-outline" label="Đổi mã PIN" onPress={() => openPin('change')} />
          <SwitchRow
            icon="finger-print"
            label={`Mở khóa bằng ${biometricLabel}`}
            hint={
              biometrics?.notEnrolled
                ? `Hãy thêm ${biometricLabel} trong Cài đặt của điện thoại trước.`
                : biometrics && !biometrics.available
                  ? 'Thiết bị không hỗ trợ.'
                  : undefined
            }
            value={settings.biometricsEnabled}
            disabled={!biometrics?.available}
            onValueChange={toggleBiometrics}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Ứng dụng tự khóa khi bạn rời đi quá 30 giây.
          </ThemedText>
        </>
      )}
    </Card>
  );
}

function SwitchRow({
  icon,
  label,
  hint,
  value,
  disabled,
  onValueChange,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={disabled ? theme.textSecondary : theme.text} />
      <View style={styles.label}>
        <ThemedText themeColor={disabled ? 'textSecondary' : 'text'}>{label}</ThemedText>
        {hint && (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        )}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ true: theme.tint, false: theme.backgroundSelected }}
        accessibilityLabel={label}
      />
    </View>
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
  note: {
    paddingBottom: Spacing.two,
  },
});
