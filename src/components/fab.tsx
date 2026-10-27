import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Floating "+" button that opens the new transaction form. */
export function AddTransactionButton() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityLabel="Thêm giao dịch"
      onPress={() => router.push('/transaction/new')}
      style={({ pressed }) => [styles.fab, { backgroundColor: theme.tint }, pressed && styles.pressed]}>
      <Ionicons name="add" size={32} color={theme.onTint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  pressed: {
    opacity: 0.8,
  },
});
