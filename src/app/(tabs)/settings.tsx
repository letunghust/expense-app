import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import type { IconName } from '@/components/category-icon';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { type Backup, BackupError, createBackup, parseBackup, type ReceiptIO, restoreBackup } from '@/db/backup';
import { CsvImportError, importTransactions, parseTransactionsCsv } from '@/db/csv-import';
import { useNotifyDataChanged } from '@/db/data-context';
import { deleteAllTransactions, listAllTransactions } from '@/db/repo';
import { pickTextFile, shareTextFile, SharingUnavailableError } from '@/files/text-files';
import { useTheme } from '@/hooks/use-theme';
import { toCsv } from '@/lib/csv';
import { formatDate, toISODate, todayISO } from '@/lib/dates';
import { confirmAction, confirmDestructive, showMessage } from '@/lib/dialog';
import { useAppLock } from '@/lock/app-lock-context';
import { authenticateWithBiometrics, type BiometricSupport, getBiometricSupport } from '@/lock/biometrics';
import { setBiometricsEnabled } from '@/lock/lock-store';
import { readReceiptBase64, writeReceiptBase64 } from '@/receipts/receipt-files';
import { cleanUpReceipts } from '@/receipts/scan';

const receiptIO: ReceiptIO = { read: readReceiptBase64, write: writeReceiptBase64 };

function shareError(error: unknown, fallback: string) {
  if (error instanceof SharingUnavailableError) {
    showMessage('Không thể chia sẻ', 'Thiết bị này không hỗ trợ chia sẻ tệp.');
  } else {
    console.error(error);
    showMessage('Lỗi', fallback);
  }
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const notifyChanged = useNotifyDataChanged();
  const theme = useTheme();
  const [busy, setBusy] = useState<string | null>(null);

  /** Runs a long data operation with a progress line, one at a time. */
  const runBusy = async (label: string, task: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  };

  const backupAll = () =>
    runBusy('Đang tạo bản sao lưu…', async () => {
      try {
        const backup = await createBackup(db, receiptIO);
        await shareTextFile({
          fileName: `chi-tieu-sao-luu-${todayISO()}.json`,
          content: JSON.stringify(backup),
          mimeType: 'application/json',
          dialogTitle: 'Lưu bản sao lưu',
        });
      } catch (error) {
        shareError(error, 'Không tạo được bản sao lưu.');
      }
    });

  const restoreOrImport = async () => {
    let picked: Awaited<ReturnType<typeof pickTextFile>>;
    try {
      picked = await pickTextFile();
    } catch (error) {
      console.error(error);
      showMessage('Lỗi', 'Không mở được file.');
      return;
    }
    if (!picked) return;
    // Backups are JSON; anything else is treated as a CSV export.
    if (picked.text.trimStart().startsWith('{')) confirmRestore(picked.text);
    else confirmCsvImport(picked.text);
  };

  const confirmRestore = (text: string) => {
    let backup: Backup;
    try {
      backup = parseBackup(text);
    } catch (error) {
      showMessage('Không khôi phục được', error instanceof BackupError ? error.message : 'File bị lỗi.');
      return;
    }
    confirmDestructive({
      title: 'Khôi phục từ bản sao lưu?',
      message:
        `Bản sao lưu ngày ${formatDate(toISODate(new Date(backup.exportedAt)))} có ${backup.transactions.length} giao dịch. ` +
        'Toàn bộ dữ liệu hiện có trên máy này sẽ được thay bằng dữ liệu trong file.',
      confirmText: 'Khôi phục',
      onConfirm: () =>
        runBusy('Đang khôi phục…', async () => {
          try {
            await restoreBackup(db, backup, receiptIO);
            await cleanUpReceipts(db);
            notifyChanged();
            showMessage('Đã khôi phục', `Đã khôi phục ${backup.transactions.length} giao dịch.`);
          } catch (error) {
            console.error(error);
            showMessage('Lỗi', 'Không khôi phục được. Dữ liệu hiện tại vẫn được giữ nguyên.');
          }
        }),
    });
  };

  const confirmCsvImport = (text: string) => {
    let parsed: ReturnType<typeof parseTransactionsCsv>;
    try {
      parsed = parseTransactionsCsv(text);
    } catch (error) {
      showMessage('Không nhập được', error instanceof CsvImportError ? error.message : 'File bị lỗi.');
      return;
    }
    const { rows, invalidLines } = parsed;
    if (rows.length === 0) {
      showMessage('Không có giao dịch', 'Không tìm thấy giao dịch nào đọc được trong file.');
      return;
    }
    confirmAction({
      title: `Nhập ${rows.length} giao dịch từ CSV?`,
      message: 'Giao dịch sẽ được thêm vào dữ liệu hiện có. Những giao dịch đã có sẵn trong ứng dụng sẽ được bỏ qua.',
      confirmText: 'Nhập',
      onConfirm: () =>
        runBusy('Đang nhập dữ liệu…', async () => {
          try {
            const result = await importTransactions(db, rows);
            notifyChanged();
            const lines = [`Đã thêm ${result.added} giao dịch.`];
            if (result.duplicates) lines.push(`Bỏ qua ${result.duplicates} giao dịch đã có.`);
            if (invalidLines.length) {
              const shown = invalidLines.slice(0, 5).join(', ');
              lines.push(`${invalidLines.length} dòng không đọc được (dòng ${shown}${invalidLines.length > 5 ? '…' : ''}).`);
            }
            if (result.createdWallets.length) lines.push(`Ví mới: ${result.createdWallets.join(', ')}.`);
            if (result.createdCategories.length) lines.push(`Danh mục mới: ${result.createdCategories.join(', ')}.`);
            showMessage('Đã nhập xong', lines.join('\n'));
          } catch (error) {
            console.error(error);
            showMessage('Lỗi', 'Không nhập được dữ liệu. Không có giao dịch nào được thêm.');
          }
        }),
    });
  };

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
      await shareTextFile({
        fileName: `chi-tieu-${todayISO()}.csv`,
        content: csv,
        mimeType: 'text/csv',
        dialogTitle: 'Xuất dữ liệu chi tiêu',
      });
    } catch (error) {
      shareError(error, 'Không xuất được tệp CSV.');
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
        await cleanUpReceipts(db);
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
          {busy && (
            <View style={styles.row}>
              <ActivityIndicator color={theme.tint} />
              <ThemedText themeColor="textSecondary">{busy}</ThemedText>
            </View>
          )}
          <SettingsRow icon="cloud-upload-outline" label="Sao lưu toàn bộ dữ liệu" onPress={backupAll} />
          <SettingsRow icon="cloud-download-outline" label="Khôi phục hoặc nhập dữ liệu" onPress={restoreOrImport} />
          <SettingsRow icon="download-outline" label="Xuất dữ liệu ra CSV (Excel)" onPress={exportCsv} />
          <SettingsRow icon="trash-outline" label="Xóa toàn bộ giao dịch" destructive onPress={confirmDeleteAll} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Đổi điện thoại? Bấm Sao lưu, gửi file sang máy mới (Zalo, Drive, email…), rồi mở ứng dụng trên máy mới
            và chọn Khôi phục. Cũng có thể nhập file CSV đã xuất trước đó.
          </ThemedText>
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
