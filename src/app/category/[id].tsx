import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { Button, ColorPicker, FormLabel, IconPicker, TextField } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useNotifyDataChanged } from '@/db/data-context';
import { createCategory, getCategory, removeCategory, updateCategory } from '@/db/repo';
import type { TransactionType } from '@/db/types';
import { confirmDestructive, showMessage } from '@/lib/dialog';

export default function CategoryFormScreen() {
  const params = useLocalSearchParams<{ id: string; type?: TransactionType }>();
  const isNew = params.id === 'new';
  const db = useSQLiteContext();
  const notifyChanged = useNotifyDataChanged();

  const [type, setType] = useState<TransactionType>(params.type ?? 'expense');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICONS[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  useEffect(() => {
    if (isNew) return;
    getCategory(db, Number(params.id)).then((category) => {
      if (!category) return;
      setType(category.type);
      setName(category.name);
      setIcon(category.icon);
      setColor(category.color);
    });
  }, [db, isNew, params.id]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showMessage('Thiếu tên', 'Vui lòng nhập tên danh mục.');
      return;
    }
    if (isNew) await createCategory(db, { name: trimmed, type, icon, color });
    else await updateCategory(db, { id: Number(params.id), name: trimmed, type, icon, color });
    notifyChanged();
    router.back();
  };

  const confirmDelete = () =>
    confirmDestructive({
      title: 'Xóa danh mục?',
      message:
        'Các giao dịch cũ thuộc danh mục này vẫn được giữ lại, nhưng bạn sẽ không chọn được danh mục này cho giao dịch mới.',
      confirmText: 'Xóa',
      onConfirm: async () => {
        await removeCategory(db, Number(params.id));
        notifyChanged();
        router.back();
      },
    });

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: isNew ? 'Thêm danh mục' : 'Sửa danh mục' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.preview}>
          <CategoryIcon icon={icon} color={color} size={64} />
          <ThemedText type="small" themeColor="textSecondary">
            {type === 'expense' ? 'Danh mục chi tiêu' : 'Danh mục thu nhập'}
          </ThemedText>
        </View>

        <FormLabel>Tên danh mục</FormLabel>
        <TextField value={name} onChangeText={setName} placeholder="Ví dụ: Cà phê" maxLength={40} autoFocus={isNew} />

        <FormLabel>Màu</FormLabel>
        <ColorPicker colors={CATEGORY_COLORS} value={color} onChange={setColor} />

        <FormLabel>Biểu tượng</FormLabel>
        <IconPicker icons={CATEGORY_ICONS} value={icon} color={color} onChange={setIcon} />

        <Button label={isNew ? 'Tạo danh mục' : 'Lưu thay đổi'} onPress={save} />
        {!isNew && <Button label="Xóa danh mục" variant="danger" onPress={confirmDelete} />}
      </ScrollView>
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
