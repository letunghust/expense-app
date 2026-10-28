import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { type SQLiteDatabase, SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { DataVersionProvider } from '@/db/data-context';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { AppLockGate } from '@/lock/app-lock-context';
import { cleanUpReceipts } from '@/receipts/scan';

async function initDb(db: SQLiteDatabase) {
  await migrateDbIfNeeded(db);
  // Images from scans that were never saved.
  await cleanUpReceipts(db);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const base = isDark ? DarkTheme : DefaultTheme;
  const colors = Colors[isDark ? 'dark' : 'light'];
  const navigationTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.tint, background: colors.background, card: colors.background },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <AppLockGate>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDb}>
          <DataVersionProvider>
            <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal', title: 'Giao dịch' }} />
              <Stack.Screen name="budget/[categoryId]" options={{ presentation: 'modal', title: 'Ngân sách' }} />
              <Stack.Screen name="categories" options={{ title: 'Danh mục' }} />
              <Stack.Screen name="category/[id]" options={{ presentation: 'modal', title: 'Danh mục' }} />
              <Stack.Screen name="wallets" options={{ title: 'Ví của bạn' }} />
              <Stack.Screen name="wallet/[id]" options={{ presentation: 'modal', title: 'Ví' }} />
              <Stack.Screen name="security/pin" options={{ presentation: 'modal', title: 'Mã PIN' }} />
            </Stack>
          </DataVersionProvider>
        </SQLiteProvider>
      </AppLockGate>
    </ThemeProvider>
  );
}
