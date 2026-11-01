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
import { strings, useI18n } from '@/i18n';
import { categoryLabel, walletLabel } from '@/i18n/defaults';
import { toCsv } from '@/lib/csv';
import { formatDate, formatDateDMY, toISODate, todayISO } from '@/lib/dates';
import { confirmAction, confirmDestructive, showMessage } from '@/lib/dialog';
import { useAppLock } from '@/lock/app-lock-context';
import { authenticateWithBiometrics, type BiometricSupport, getBiometricSupport } from '@/lock/biometrics';
import { setBiometricsEnabled } from '@/lock/lock-store';
import { readReceiptBase64, writeReceiptBase64 } from '@/receipts/receipt-files';
import { cleanUpReceipts } from '@/receipts/scan';

const receiptIO: ReceiptIO = { read: readReceiptBase64, write: writeReceiptBase64 };

function shareError(error: unknown, fallback: string) {
  const t = strings();
  if (error instanceof SharingUnavailableError) {
    showMessage(t.settings.cannotShare, t.settings.cannotShareMessage);
  } else {
    console.error(error);
    showMessage(t.common.error, fallback);
  }
}

export default function SettingsScreen() {
  const { t } = useI18n();
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
    runBusy(t.settings.creatingBackup, async () => {
      try {
        const backup = await createBackup(db, receiptIO);
        await shareTextFile({
          fileName: `chi-tieu-sao-luu-${todayISO()}.json`,
          content: JSON.stringify(backup),
          mimeType: 'application/json',
          dialogTitle: t.settings.saveBackup,
        });
      } catch (error) {
        shareError(error, t.settings.backupFailed);
      }
    });

  const restoreOrImport = async () => {
    let picked: Awaited<ReturnType<typeof pickTextFile>>;
    try {
      picked = await pickTextFile();
    } catch (error) {
      console.error(error);
      showMessage(t.common.error, t.settings.openFileFailed);
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
      showMessage(t.settings.restoreFailedTitle, error instanceof BackupError ? error.message : t.settings.brokenFile);
      return;
    }
    confirmDestructive({
      title: t.settings.restoreTitle,
      message: t.settings.restoreMessage(formatDate(toISODate(new Date(backup.exportedAt))), backup.transactions.length),
      confirmText: t.settings.restore,
      onConfirm: () =>
        runBusy(t.settings.restoring, async () => {
          try {
            await restoreBackup(db, backup, receiptIO);
            await cleanUpReceipts(db);
            notifyChanged();
            showMessage(t.settings.restored, t.settings.restoredMessage(backup.transactions.length));
          } catch (error) {
            console.error(error);
            showMessage(t.common.error, t.settings.restoreFailed);
          }
        }),
    });
  };

  const confirmCsvImport = (text: string) => {
    let parsed: ReturnType<typeof parseTransactionsCsv>;
    try {
      parsed = parseTransactionsCsv(text);
    } catch (error) {
      showMessage(t.settings.importFailedTitle, error instanceof CsvImportError ? error.message : t.settings.brokenFile);
      return;
    }
    const { rows, invalidLines } = parsed;
    if (rows.length === 0) {
      showMessage(t.settings.noTransactions, t.settings.noReadableTransactions);
      return;
    }
    confirmAction({
      title: t.settings.importTitle(rows.length),
      message: t.settings.importMessage,
      confirmText: t.settings.import,
      onConfirm: () =>
        runBusy(t.settings.importing, async () => {
          try {
            const result = await importTransactions(db, rows);
            notifyChanged();
            const lines = [t.settings.imported(result.added)];
            if (result.duplicates) lines.push(t.settings.skipped(result.duplicates));
            if (invalidLines.length) {
              const shown = invalidLines.slice(0, 5).join(', ') + (invalidLines.length > 5 ? '…' : '');
              lines.push(t.settings.unreadableLines(invalidLines.length, shown));
            }
            if (result.createdWallets.length) lines.push(t.settings.newWallets(result.createdWallets.join(', ')));
            if (result.createdCategories.length) {
              lines.push(t.settings.newCategories(result.createdCategories.map(categoryLabel).join(', ')));
            }
            showMessage(t.settings.importDone, lines.join('\n'));
          } catch (error) {
            console.error(error);
            showMessage(t.common.error, t.settings.importFailed);
          }
        }),
    });
  };

  const exportCsv = async () => {
    try {
      const rows = await listAllTransactions(db);
      if (rows.length === 0) {
        showMessage(t.settings.noData, t.settings.noDataMessage);
        return;
      }
      const csv = toCsv(
        t.files.csvHeaders,
        rows.map((r) => [
          // Always day/month/year so the file reads back the same in any language.
          formatDateDMY(r.date),
          t.common[r.type],
          categoryLabel(r.categoryName),
          walletLabel(r.walletName),
          r.amount,
          r.note,
        ])
      );
      await shareTextFile({
        fileName: `chi-tieu-${todayISO()}.csv`,
        content: csv,
        mimeType: 'text/csv',
        dialogTitle: t.settings.exportTitle,
      });
    } catch (error) {
      shareError(error, t.settings.exportFailed);
    }
  };

  const confirmDeleteAll = () =>
    confirmDestructive({
      title: t.settings.deleteAllTitle,
      message: t.settings.deleteAllMessage,
      confirmText: t.settings.deleteAllConfirm,
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
          <SettingsRow icon="wallet-outline" label={t.settings.manageWallets} onPress={() => router.push('/wallets')} />
          <SettingsRow
            icon="pricetags-outline"
            label={t.settings.manageCategories}
            onPress={() => router.push('/categories')}
          />
          <SettingsRow
            icon="language-outline"
            label={t.settings.language}
            value={t.languageName}
            onPress={() => router.push('/language')}
          />
        </Card>

        <Card style={styles.group}>
          {busy && (
            <View style={styles.row}>
              <ActivityIndicator color={theme.tint} />
              <ThemedText themeColor="textSecondary">{busy}</ThemedText>
            </View>
          )}
          <SettingsRow icon="cloud-upload-outline" label={t.settings.backup} onPress={backupAll} />
          <SettingsRow icon="cloud-download-outline" label={t.settings.restoreOrImport} onPress={restoreOrImport} />
          <SettingsRow icon="download-outline" label={t.settings.exportCsv} onPress={exportCsv} />
          <SettingsRow icon="trash-outline" label={t.settings.deleteAll} destructive onPress={confirmDeleteAll} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t.settings.moveHint}
          </ThemedText>
        </Card>

        <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
          {t.settings.footer(Constants.expoConfig?.version ?? '1.0.0')}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function SecurityCard() {
  const { t } = useI18n();
  const { settings, reload } = useAppLock();
  const [biometrics, setBiometrics] = useState<BiometricSupport>();

  useEffect(() => {
    getBiometricSupport().then(setBiometrics);
  }, []);

  const openPin = (mode: 'create' | 'change' | 'disable') =>
    router.push({ pathname: '/security/pin', params: { mode } });

  const toggleBiometrics = async (enabled: boolean) => {
    // Confirm the finger/face actually works before relying on it.
    if (enabled && !(await authenticateWithBiometrics(t.settings.confirmBiometrics(biometrics?.label ?? t.lock.fingerprint)))) return;
    await setBiometricsEnabled(enabled);
    await reload();
  };

  const biometricLabel = biometrics?.label ?? t.lock.fingerprint;

  return (
    <Card style={styles.group}>
      <SwitchRow
        icon="lock-closed-outline"
        label={t.settings.pinLock}
        value={settings.pinEnabled}
        onValueChange={(on) => openPin(on ? 'create' : 'disable')}
      />
      {settings.pinEnabled && (
        <>
          <SettingsRow icon="keypad-outline" label={t.settings.changePin} onPress={() => openPin('change')} />
          <SwitchRow
            icon="finger-print"
            label={t.settings.unlockWith(biometricLabel)}
            hint={
              biometrics?.notEnrolled
                ? t.settings.enrollFirst(biometricLabel)
                : biometrics && !biometrics.available
                  ? t.settings.notSupported
                  : undefined
            }
            value={settings.biometricsEnabled}
            disabled={!biometrics?.available}
            onValueChange={toggleBiometrics}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t.settings.autoLockHint}
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
  value,
  onPress,
  destructive,
}: {
  icon: IconName;
  label: string;
  /** Current value, shown before the arrow. */
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const theme = useTheme();
  const color = destructive ? theme.expense : theme.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={color} />
      <ThemedText style={[styles.label, { color }]}>{label}</ThemedText>
      {value && <ThemedText themeColor="textSecondary">{value}</ThemedText>}
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
