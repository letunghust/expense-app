import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useStrings } from '@/i18n';
import { type PinLength } from '@/lib/app-lock';
import { useAppLock } from '@/lock/app-lock-context';
import { checkPin, clearPin, savePin } from '@/lock/lock-store';
import { PinPad } from '@/lock/pin-pad';

type Mode = 'create' | 'change' | 'disable';
type Step = 'verify' | 'enter' | 'confirm';

/** Create, change or remove the app PIN, depending on the `mode` param. */
export default function PinSetupScreen() {
  const { mode = 'create' } = useLocalSearchParams<{ mode?: Mode }>();
  const t = useStrings();
  const { settings, reload } = useAppLock();

  const [step, setStep] = useState<Step>(mode === 'create' ? 'enter' : 'verify');
  const [length, setLength] = useState<PinLength>(step === 'verify' ? settings.pinLength : 6);
  const [firstPin, setFirstPin] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [errorCount, setErrorCount] = useState(0);

  const fail = (message: string) => {
    setError(message);
    setErrorCount((n) => n + 1);
    setValue('');
  };

  const onComplete = async (pin: string) => {
    if (step === 'verify') {
      if (!(await checkPin(pin))) {
        fail(t.pin.wrong);
        return;
      }
      if (mode === 'disable') {
        await clearPin();
        await reload();
        router.back();
        return;
      }
      setStep('enter');
      setLength(6);
    } else if (step === 'enter') {
      setFirstPin(pin);
      setStep('confirm');
    } else {
      if (pin !== firstPin) {
        setStep('enter');
        setFirstPin('');
        fail(t.pin.mismatch);
        return;
      }
      await savePin(pin);
      await reload();
      router.back();
      return;
    }
    setError('');
    setValue('');
  };

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t.pin[mode] }} />
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.prompt}>
          {t.pin[step]}
        </ThemedText>
        <ThemedText type="small" themeColor={error ? 'expense' : 'textSecondary'} style={styles.center}>
          {error || (step === 'enter' ? t.pin.digits(length) : ' ')}
        </ThemedText>
      </View>

      <PinPad length={length} value={value} onChange={setValue} onComplete={onComplete} errorCount={errorCount} />

      {step === 'enter' ? (
        <Pressable
          hitSlop={8}
          onPress={() => {
            setLength(length === 6 ? 4 : 6);
            setValue('');
          }}>
          <ThemedText type="small" themeColor="tint">
            {length === 6 ? t.pin.use4 : t.pin.use6}
          </ThemedText>
        </Pressable>
      ) : (
        <View />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    padding: Spacing.three,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  prompt: {
    fontSize: 20,
    lineHeight: 28,
  },
  center: {
    textAlign: 'center',
  },
});
