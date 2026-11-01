import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deviceLanguage, LANGUAGES, type LanguageSetting, stringsFor, useI18n } from '@/i18n';

/** Pick the app language, or follow the phone's. Each language is listed in its own name. */
export default function LanguageScreen() {
  const theme = useTheme();
  const { t, setting, setLanguageSetting } = useI18n();

  const options: { value: LanguageSetting; label: string; hint?: string }[] = [
    { value: 'system', label: t.language.system, hint: t.language.systemHint(stringsFor(deviceLanguage()).languageName) },
    ...LANGUAGES.map((language) => ({ value: language, label: stringsFor(language).languageName })),
  ];

  return (
    <ThemedView style={styles.screen}>
      {/* Set here too: the navigator keeps the old title of the screen that is open while switching. */}
      <Stack.Screen options={{ title: t.screens.language }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.group}>
          {options.map((option) => {
            const selected = option.value === setting;
            return (
              <Pressable
                key={option.value}
                onPress={() => setLanguageSetting(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={styles.label}>
                  <ThemedText>{option.label}</ThemedText>
                  {option.hint && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {option.hint}
                    </ThemedText>
                  )}
                </View>
                {selected && <Ionicons name="checkmark" size={22} color={theme.tint} />}
              </Pressable>
            );
          })}
        </Card>
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {t.language.note}
        </ThemedText>
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
  },
  group: {
    paddingVertical: Spacing.one,
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 56,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    flex: 1,
  },
  note: {
    paddingHorizontal: Spacing.one,
  },
});
