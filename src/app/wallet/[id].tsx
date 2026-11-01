import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, FormLabel, IconPicker, TextField } from '@/components/form';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { ThemedView } from '@/components/themed-view';
import { WALLET_ICONS } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useDbQuery, useNotifyDataChanged } from '@/db/data-context';
import { createWallet, deleteWallet, listWallets, updateWallet } from '@/db/repo';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { nameToStore, walletLabel } from '@/i18n/defaults';
import { confirmDestructive, showMessage } from '@/lib/dialog';
import { formatAmountInput, groupDigits, parseAmount } from '@/lib/money';
import { cleanUpReceipts } from '@/receipts/scan';

export default function WalletFormScreen() {
  const t = useStrings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const notifyChanged = useNotifyDataChanged();
  const theme = useTheme();

  const wallets = useDbQuery((db) => listWallets(db), []);
  const wallet = wallets?.find((w) => w.id === Number(id));

  // Each field shows the saved value until the user edits it.
  const [editedName, setName] = useState<string>();
  const [editedIcon, setIcon] = useState<string>();
  const [editedInitial, setInitialText] = useState<string>();
  const name = editedName ?? (wallet ? walletLabel(wallet.name) : '');
  const icon = editedIcon ?? wallet?.icon ?? WALLET_ICONS[0];
  const initialText = editedInitial ?? (wallet?.initialBalance ? groupDigits(wallet.initialBalance) : '');

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showMessage(t.wallets.missingName, t.wallets.missingNameMessage);
      return;
    }
    const initialBalance = parseAmount(initialText) ?? 0;
    if (isNew) await createWallet(db, { name: trimmed, icon, initialBalance });
    else {
      const stored = wallet ? nameToStore(trimmed, wallet.name, walletLabel) : trimmed;
      await updateWallet(db, { id: Number(id), name: stored, icon, initialBalance });
    }
    notifyChanged();
    router.back();
  };

  const confirmDelete = () => {
    if (!wallet || !wallets) return;
    if (wallets.length <= 1) {
      showMessage(t.wallets.cannotDelete, t.wallets.keepOne);
      return;
    }
    const message =
      wallet.transactionCount > 0 ? t.wallets.deleteWithTransactions(wallet.transactionCount) : t.wallets.deleteEmpty;
    confirmDestructive({
      title: t.wallets.deleteTitle(walletLabel(wallet.name)),
      message,
      confirmText: t.common.delete,
      onConfirm: async () => {
        await deleteWallet(db, wallet.id);
        await cleanUpReceipts(db);
        notifyChanged();
        router.back();
      },
    });
  };

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: isNew ? t.wallets.newTitle : t.wallets.editTitle }} />
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <FormLabel>{t.wallets.name}</FormLabel>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder={t.wallets.namePlaceholder}
          maxLength={40}
          autoFocus={isNew}
        />

        <FormLabel>{t.wallets.initialBalance}</FormLabel>
        <TextField
          value={initialText}
          onChangeText={(text) => setInitialText(formatAmountInput(text))}
          placeholder="0 ₫"
          keyboardType="number-pad"
        />

        <FormLabel>{t.wallets.icon}</FormLabel>
        <IconPicker icons={WALLET_ICONS} value={icon} color={theme.tint} onChange={setIcon} />

        <Button label={isNew ? t.wallets.create : t.common.saveChanges} onPress={save} />
        {!isNew && <Button label={t.wallets.delete} variant="danger" onPress={confirmDelete} />}
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
});
