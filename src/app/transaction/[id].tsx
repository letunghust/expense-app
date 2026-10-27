import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
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

export default function TransactionFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const notifyChanged = useNotifyDataChanged();
  const theme = useTheme();

  const [loaded, setLoaded] = useState(isNew);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<number>();
  const [walletId, setWalletId] = useState<number>();
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
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
      setLoaded(true);
    });
  }, [db, id, isNew]);

  // New transactions default to the first wallet until the user picks one.
  const selectedWalletId = walletId ?? wallets?.[0]?.id;

  const visibleCategories = categories?.filter((c) => c.type === type) ?? [];

  const changeType = (next: TransactionType) => {
    setType(next);
    if (categories?.find((c) => c.id === categoryId)?.type !== next) setCategoryId(undefined);
  };

  const save = async () => {
    const amount = parseAmount(amountText);
    if (amount == null) {
      showMessage('Thiếu số tiền', 'Vui lòng nhập số tiền lớn hơn 0.');
      return;
    }
    if (categoryId == null) {
      showMessage('Thiếu danh mục', 'Vui lòng chọn một danh mục.');
      return;
    }
    if (selectedWalletId == null) {
      showMessage('Thiếu ví', 'Vui lòng tạo ít nhất một ví trong phần Cài đặt.');
      return;
    }
    setSaving(true);
    try {
      const input = { type, amount, categoryId, walletId: selectedWalletId, date, note: note.trim() };
      if (isNew) await createTransaction(db, input);
      else await updateTransaction(db, Number(id), input);
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
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              autoFocus={isNew}
              style={[styles.amountInput, { color: amountColor }]}
              accessibilityLabel="Số tiền"
            />
            <ThemedText style={[styles.currency, { color: amountColor }]}>₫</ThemedText>
          </View>

          <ThemedText type="smallBold">Danh mục</ThemedText>
          <View style={styles.categoryGrid}>
            {visibleCategories.map((c) => {
              const selected = c.id === categoryId;
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
        </ScrollView>
      </KeyboardAvoidingView>
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
