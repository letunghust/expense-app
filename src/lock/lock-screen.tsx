import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';
import { FREE_ATTEMPTS } from '@/lib/app-lock';
import { showMessage } from '@/lib/dialog';

import { authenticateWithBiometrics, getBiometricSupport } from './biometrics';
import { checkPin, type FailureState, loadFailures, type LockSettings, recordFailure, resetFailures } from './lock-store';
import { PinPad } from './pin-pad';

export function LockScreen({ settings, onUnlock }: { settings: LockSettings; onUnlock: () => void }) {
  const theme = useTheme();
  const t = useStrings();
  const [pin, setPin] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const [failures, setFailures] = useState<FailureState>({ count: 0, lockedUntil: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [biometricLabel, setBiometricLabel] = useState<string>();

  const lockedFor = Math.max(0, Math.ceil((failures.lockedUntil - now) / 1000));

  const tryBiometrics = async () => {
    if (await authenticateWithBiometrics(t.lock.unlockPrompt)) {
      await resetFailures();
      onUnlock();
    }
  };

  useEffect(() => {
    loadFailures().then(setFailures);
    if (!settings.biometricsEnabled) return;
    getBiometricSupport().then((support) => {
      if (!support.available) return;
      setBiometricLabel(support.label);
      tryBiometrics();
    });
    // Runs once when the lock screen appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ticks the lockout countdown.
  useEffect(() => {
    if (failures.lockedUntil <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [failures.lockedUntil]);

  const submit = async (entered: string) => {
    if (await checkPin(entered)) {
      await resetFailures();
      onUnlock();
      return;
    }
    const next = await recordFailure();
    setFailures(next);
    setNow(Date.now());
    setPin('');
    setErrorCount((n) => n + 1);
  };

  const remaining = FREE_ATTEMPTS - failures.count;
  const message =
    lockedFor > 0
      ? t.lock.tooManyAttempts(lockedFor)
      : failures.count > 0
        ? remaining > 0
          ? t.lock.wrongPinRemaining(remaining)
          : t.lock.wrongPin
        : ' ';

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="lock-closed" size={40} color={theme.tint} />
          <ThemedText type="smallBold" style={styles.title}>
            {t.lock.enterPin}
          </ThemedText>
          <ThemedText type="small" themeColor={failures.count > 0 ? 'expense' : 'textSecondary'} style={styles.center}>
            {message}
          </ThemedText>
        </View>

        <PinPad
          length={settings.pinLength}
          value={pin}
          onChange={setPin}
          onComplete={submit}
          disabled={lockedFor > 0}
          errorCount={errorCount}
          extraKey={
            biometricLabel ? (
              <Pressable onPress={tryBiometrics} hitSlop={8} accessibilityLabel={t.settings.unlockWith(biometricLabel)}>
                <Ionicons name="finger-print" size={36} color={theme.tint} />
              </Pressable>
            ) : undefined
          }
        />

        <Pressable
          hitSlop={8}
          onPress={() =>
showMessage(t.lock.forgotTitle, t.lock.forgotMessage)
          }>
          <ThemedText type="small" themeColor="tint">
            {t.lock.forgotTitle}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    padding: Spacing.three,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
  },
  center: {
    textAlign: 'center',
  },
});
