import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { Button, ColorPicker, FormLabel, IconPicker, TextField } from '@/components/form';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useNotifyDataChanged } from '@/db/data-context';
import { createCategory, getCategory, removeCategory, updateCategory } from '@/db/repo';
import type { TransactionType } from '@/db/types';
import { useStrings } from '@/i18n';
import { categoryLabel, nameToStore } from '@/i18n/defaults';
import { confirmDestructive, showMessage } from '@/lib/dialog';

export default function CategoryFormScreen() {
  const t = useStrings();
  const params = useLocalSearchParams<{ id: string; type?: TransactionType }>();
  const isNew = params.id === 'new';
  const db = useSQLiteContext();
  const notifyChanged = useNotifyDataChanged();

  const [type, setType] = useState<TransactionType>(params.type ?? 'expense');
  const [name, setName] = useState('');
  const [storedName, setStoredName] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICONS[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  useEffect(() => {
    if (isNew) return;
    getCategory(db, Number(params.id)).then((category) => {
      if (!category) return;
      setType(category.type);
      setName(categoryLabel(category.name));
      setStoredName(category.name);
      setIcon(category.icon);
      setColor(category.color);
    });
  }, [db, isNew, params.id]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showMessage(t.categories.missingName, t.categories.missingNameMessage);
      return;
    }
    if (isNew) await createCategory(db, { name: trimmed, type, icon, color });
    else {
      const stored = nameToStore(trimmed, storedName, categoryLabel);
      await updateCategory(db, { id: Number(params.id), name: stored, type, icon, color });
    }
    notifyChanged();
    router.back();
  };

  const confirmDelete = () =>
    confirmDestructive({
      title: t.categories.deleteTitle,
      message: t.categories.deleteMessage,
      confirmText: t.common.delete,
      onConfirm: async () => {
        await removeCategory(db, Number(params.id));
        notifyChanged();
        router.back();
      },
    });

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: isNew ? t.categories.newTitle : t.categories.editTitle }} />
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <View style={styles.preview}>
          <CategoryIcon icon={icon} color={color} size={64} />
          <ThemedText type="small" themeColor="textSecondary">
            {type === 'expense' ? t.categories.expenseCategory : t.categories.incomeCategory}
          </ThemedText>
        </View>

        <FormLabel>{t.categories.name}</FormLabel>
        <TextField value={name} onChangeText={setName} placeholder={t.categories.namePlaceholder} maxLength={40} autoFocus={isNew} />

        <FormLabel>{t.categories.color}</FormLabel>
        <ColorPicker colors={CATEGORY_COLORS} value={color} onChange={setColor} />

        <FormLabel>{t.categories.icon}</FormLabel>
        <IconPicker icons={CATEGORY_ICONS} value={icon} color={color} onChange={setIcon} />

        <Button label={isNew ? t.categories.create : t.common.saveChanges} onPress={save} />
        {!isNew && <Button label={t.categories.delete} variant="danger" onPress={confirmDelete} />}
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
  preview: {
    alignItems: 'center',
    gap: Spacing.two,
  },
});
