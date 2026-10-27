import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDbQuery } from '@/db/data-context';
import { listCategories } from '@/db/repo';
import type { TransactionType } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';

export default function CategoriesScreen() {
  const theme = useTheme();
  const [type, setType] = useState<TransactionType>('expense');
  const categories = useDbQuery((db) => listCategories(db, type), [type]);

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              hitSlop={8}
              accessibilityLabel="Thêm danh mục"
              onPress={() => router.push({ pathname: '/category/[id]', params: { id: 'new', type } })}>
              <Ionicons name="add" size={28} color={theme.tint} />
            </Pressable>
          ),
        }}
      />
      <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
        {(['expense', 'income'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setType(t)}
            style={[styles.segmentItem, type === t && { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold">{t === 'expense' ? 'Chi tiêu' : 'Thu nhập'}</ThemedText>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={categories ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/category/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <CategoryIcon icon={item.icon} color={item.color} />
            <ThemedText style={styles.name}>{item.name}</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    margin: Spacing.three,
    marginBottom: 0,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  list: {
    padding: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  name: {
    flex: 1,
  },
});
