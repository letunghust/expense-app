import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';

export default function TabLayout() {
  const theme = useTheme();
  const t = useStrings();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.textSecondary,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t.screens.overview,
          tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: t.screens.transactions,
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: t.screens.budgets,
          tabBarIcon: ({ color, size }) => <Ionicons name="speedometer" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.screens.settings,
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
