import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { type SQLiteDatabase, SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { DataVersionProvider } from '@/db/data-context';
import { DatabaseErrorBoundary } from '@/db/database-error-boundary';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { I18nProvider, useI18n } from '@/i18n';
import { AppLockGate } from '@/lock/app-lock-context';
import { cleanUpReceipts } from '@/receipts/scan';

async function initDb(db: SQLiteDatabase) {
  await migrateDbIfNeeded(db);
  // Images from scans that were never saved.
  await cleanUpReceipts(db);
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}

function App() {
  const { language, t } = useI18n();
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
        <DatabaseErrorBoundary>
          <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDb}>
            <DataVersionProvider>
              {/* Keyed by language: every screen re-renders its text when the language changes. */}
            <Stack key={language} screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal', title: t.screens.transaction }} />
                <Stack.Screen name="budget/[categoryId]" options={{ presentation: 'modal', title: t.screens.budget }} />
                <Stack.Screen name="categories" options={{ title: t.screens.categories }} />
                <Stack.Screen name="category/[id]" options={{ presentation: 'modal', title: t.screens.category }} />
                <Stack.Screen name="wallets" options={{ title: t.screens.wallets }} />
                <Stack.Screen name="wallet/[id]" options={{ presentation: 'modal', title: t.screens.wallet }} />
                <Stack.Screen name="security/pin" options={{ presentation: 'modal', title: t.screens.pin }} />
                <Stack.Screen name="language" options={{ title: t.screens.language }} />
              </Stack>
            </DataVersionProvider>
          </SQLiteProvider>
        </DatabaseErrorBoundary>
      </AppLockGate>
    </ThemeProvider>
  );
}
