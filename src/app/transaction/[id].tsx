import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDbQuery, useNotifyDataChanged } from '@/db/data-context';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listCategories,
  listWallets,
  updateTransaction,
} from '@/db/repo';
import type { TransactionType } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { todayISO } from '@/lib/dates';
import { confirmDestructive, showMessage } from '@/lib/dialog';
import { formatAmountInput, groupDigits, parseAmount } from '@/lib/money';
import { receiptNote } from '@/lib/receipt-parser';
import { ReceiptAttachment, type ScanStatus, scanStatusOf } from '@/receipts/receipt-attachment';
import { receiptUri } from '@/receipts/receipt-files';
import { ReceiptViewer } from '@/receipts/receipt-viewer';
import { cleanUpReceipts, getStashedScan, scanTransferReceipt } from '@/receipts/scan';

export default function TransactionFormScreen() {
  // `scan` is set when the scan button on the main screens already read a screenshot.
  const { id, scan: scanKey } = useLocalSearchParams<{ id: string; scan?: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const notifyChanged = useNotifyDataChanged();
  const theme = useTheme();

  const [initialScan] = useState(() => getStashedScan(scanKey));
  const [loaded, setLoaded] = useState(isNew);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState(initialScan?.amount ? groupDigits(initialScan.amount) : '');
  const [categoryId, setCategoryId] = useState<number>();
  const [walletId, setWalletId] = useState<number>();
  const [date, setDate] = useState(initialScan?.date ?? todayISO());
  const [note, setNote] = useState(initialScan ? receiptNote(initialScan) : '');
  const [receipt, setReceipt] = useState<string | null>(initialScan?.receipt ?? null);
  // Suggestions from a scanned screenshot, used until the user picks a category / wallet.
  const [categoryHint, setCategoryHint] = useState(initialScan?.categoryHint);
  const [fromTransfer, setFromTransfer] = useState(initialScan != null);
  const [scanStatus, setScanStatus] = useState<ScanStatus | undefined>(initialScan && scanStatusOf(initialScan));
  const [ocrText, setOcrText] = useState(initialScan?.ocrText);
  const [scanning, setScanning] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(false);
  const [saving, setSaving] = useState(false);

  const categories = useDbQuery((db) => listCategories(db), []);
  const wallets = useDbQuery((db) => listWallets(db), []);

  useEffect(() => {
    if (isNew) return;
    getTransaction(db, Number(id)).then((tx) => {
      if (!tx) {
        router.back();
        return;
      }
      setType(tx.type);
      setAmountText(groupDigits(tx.amount));
      setCategoryId(tx.categoryId);
      setWalletId(tx.walletId);
      setDate(tx.date);
      setNote(tx.note);
      setReceipt(tx.receipt);
      setLoaded(true);
    });
  }, [db, id, isNew]);

  const selectedCategoryId =
    categoryId ?? (categoryHint ? categories?.find((c) => c.type === type && c.name === categoryHint)?.id : undefined);
  // New transactions default to the first wallet until the user picks one; bank transfers to a bank wallet.
  const bankWalletId = fromTransfer ? wallets?.find((w) => w.icon === 'card')?.id : undefined;
  const selectedWalletId = walletId ?? bankWalletId ?? wallets?.[0]?.id;

  const visibleCategories = categories?.filter((c) => c.type === type) ?? [];

  const changeType = (next: TransactionType) => {
    setType(next);
    if (categories?.find((c) => c.id === selectedCategoryId)?.type !== next) setCategoryId(undefined);
  };

  const scanReceipt = async () => {
    setScanning(true);
    try {
      const result = await scanTransferReceipt();
      if (!result) return;
      setReceipt(result.receipt);
      setScanStatus(scanStatusOf(result));
      setOcrText(result.ocrText);
      setFromTransfer(true);
      if (result.amount) setAmountText(groupDigits(result.amount));
      if (result.date) setDate(result.date);
      const scannedNote = receiptNote(result);
      if (scannedNote) setNote(scannedNote);
      if (result.categoryHint) setCategoryHint(result.categoryHint);
    } catch (error) {
      console.error(error);
      showMessage('Lỗi', 'Không mở được ảnh. Vui lòng thử lại.');
    } finally {
      setScanning(false);
    }
  };

  const removeReceipt = () => {
    setReceipt(null);
    setScanStatus(undefined);
    setOcrText(undefined);
  };

  const save = async () => {
    const amount = parseAmount(amountText);
    if (amount == null) {
      showMessage('Thiếu số tiền', 'Vui lòng nhập số tiền lớn hơn 0.');
      return;
    }
    if (selectedCategoryId == null) {
      showMessage('Thiếu danh mục', 'Vui lòng chọn một danh mục.');
      return;
    }
    if (selectedWalletId == null) {
      showMessage('Thiếu ví', 'Vui lòng tạo ít nhất một ví trong phần Cài đặt.');
      return;
    }
    setSaving(true);
    try {
      const input = {
        type,
        amount,
        categoryId: selectedCategoryId,
        walletId: selectedWalletId,
        date,
        note: note.trim(),
        receipt,
      };
      if (isNew) await createTransaction(db, input);
      else await updateTransaction(db, Number(id), input);
      await cleanUpReceipts(db);
      notifyChanged();
      router.back();
    } catch (error) {
      console.error(error);
      showMessage('Lỗi', 'Không lưu được giao dịch. Vui lòng thử lại.');
      setSaving(false);
    }
  };

  const confirmDelete = () =>
    confirmDestructive({
      title: 'Xóa giao dịch?',
      message: 'Giao dịch này sẽ bị xóa vĩnh viễn.',
      confirmText: 'Xóa',
      onConfirm: async () => {
        await deleteTransaction(db, Number(id));
        await cleanUpReceipts(db);
        notifyChanged();
        router.back();
      },
    });

  if (!loaded || !categories || !wallets) {
    return (
      <ThemedView style={[styles.screen, styles.center]}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const amountColor = type === 'income' ? theme.income : theme.expense;

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          title: isNew ? 'Thêm giao dịch' : 'Sửa giao dịch',
          headerRight: isNew
            ? undefined
            : () => (
                <Pressable hitSlop={8} onPress={confirmDelete} accessibilityLabel="Xóa giao dịch">
                  <Ionicons name="trash-outline" size={22} color={theme.expense} />
                </Pressable>
              ),
        }}
      />
      <KeyboardAwareScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ReceiptAttachment
          receipt={receipt}
          status={scanStatus}
          ocrText={ocrText}
          scanning={scanning}
          onScan={scanReceipt}
          onView={() => setViewingReceipt(true)}
          onRemove={removeReceipt}
        />

        <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          {(['expense', 'income'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => changeType(t)}
              style={[styles.segmentItem, type === t && { backgroundColor: t === 'income' ? theme.income : theme.expense }]}>
              <ThemedText type="smallBold" style={type === t ? { color: theme.onTint } : undefined}>
                {t === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={[styles.amountBox, { borderBottomColor: amountColor }]}>
          <TextInput
            value={amountText}
            onChangeText={(text) => setAmountText(formatAmountInput(text))}
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            autoFocus={isNew && !initialScan}
            style={[styles.amountInput, { color: amountColor }]}
            accessibilityLabel="Số tiền"
          />
          <ThemedText style={[styles.currency, { color: amountColor }]}>₫</ThemedText>
        </View>

        <ThemedText type="smallBold">Danh mục</ThemedText>
        <View style={styles.categoryGrid}>
          {visibleCategories.map((c) => {
            const selected = c.id === selectedCategoryId;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                style={[
                  styles.categoryItem,
                  { borderColor: selected ? c.color : 'transparent' },
                  selected && { backgroundColor: `${c.color}1A` },
                ]}>
                <CategoryIcon icon={c.icon} color={c.color} />
                <ThemedText type="small" numberOfLines={1} style={styles.categoryName}>
                  {c.name}
                </ThemedText>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push({ pathname: '/category/[id]', params: { id: 'new', type } })}
            style={[styles.categoryItem, { borderColor: 'transparent' }]}>
            <CategoryIcon icon="add" color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.categoryName}>
              Thêm mới
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText type="smallBold">Ví</ThemedText>
        <View style={styles.chips}>
          {wallets.map((w) => (
            <Chip key={w.id} label={w.name} selected={w.id === selectedWalletId} onPress={() => setWalletId(w.id)} />
          ))}
        </View>

        <DateField value={date} onChange={setDate} />

        <View style={[styles.noteRow, { borderBottomColor: theme.border }]}>
          <Ionicons name="create-outline" size={22} color={theme.textSecondary} />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Ghi chú (không bắt buộc)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.noteInput, { color: theme.text }]}
            maxLength={200}
          />
        </View>

        <Pressable
          onPress={save}
          disabled={saving}
          style={({ pressed }) => [styles.saveButton, { backgroundColor: theme.tint }, (pressed || saving) && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: theme.onTint }}>
            {isNew ? 'Lưu giao dịch' : 'Cập nhật'}
          </ThemedText>
        </Pressable>
      </KeyboardAwareScrollView>
      <ReceiptViewer
        uri={viewingReceipt && receipt ? receiptUri(receipt) : null}
        onClose={() => setViewingReceipt(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  amountInput: {
    flex: 1,
    minWidth: 0, // web: <input> otherwise keeps its default intrinsic width and overflows
    fontSize: 36,
    fontWeight: 700,
    paddingVertical: Spacing.two,
  },
  currency: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 700,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryItem: {
    width: '25%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  categoryName: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  noteInput: {
    flex: 1,
    minWidth: 0, // web: <input> otherwise keeps its default intrinsic width and overflows
    fontSize: 16,
    paddingVertical: Spacing.two,
  },
  saveButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
