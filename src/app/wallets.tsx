import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { CategoryIcon } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDbQuery } from '@/db/data-context';
import { listWallets } from '@/db/repo';
import { useTheme } from '@/hooks/use-theme';
import { formatVND } from '@/lib/money';

export default function WalletsScreen() {
  const theme = useTheme();
  const wallets = useDbQuery((db) => listWallets(db), []);
  const total = wallets?.reduce((sum, w) => sum + w.balance, 0) ?? 0;

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              hitSlop={8}
              accessibilityLabel="Thêm ví"
              onPress={() => router.push({ pathname: '/wallet/[id]', params: { id: 'new' } })}>
              <Ionicons name="add" size={28} color={theme.tint} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={wallets ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Card style={styles.totalCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Tổng số dư
            </ThemedText>
            <ThemedText style={styles.total}>{formatVND(total)}</ThemedText>
          </Card>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/wallet/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <CategoryIcon icon={item.icon} color={theme.tint} />
            <View style={styles.flex}>
              <ThemedText>{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.transactionCount} giao dịch
              </ThemedText>
            </View>
            <ThemedText type="smallBold" themeColor={item.balance < 0 ? 'expense' : 'text'}>
              {formatVND(item.balance)}
            </ThemedText>
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
  list: {
    padding: Spacing.three,
  },
  totalCard: {
    marginBottom: Spacing.three,
  },
  total: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 700,
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
  flex: {
    flex: 1,
  },
});
