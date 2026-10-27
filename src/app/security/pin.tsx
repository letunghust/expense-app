import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { type PinLength } from '@/lib/app-lock';
import { useAppLock } from '@/lock/app-lock-context';
import { checkPin, clearPin, savePin } from '@/lock/lock-store';
import { PinPad } from '@/lock/pin-pad';

type Mode = 'create' | 'change' | 'disable';
type Step = 'verify' | 'enter' | 'confirm';

const TITLES: Record<Mode, string> = {
  create: 'Tạo mã PIN',
  change: 'Đổi mã PIN',
  disable: 'Tắt khóa ứng dụng',
};

const PROMPTS: Record<Step, string> = {
  verify: 'Nhập mã PIN hiện tại',
  enter: 'Nhập mã PIN mới',
  confirm: 'Nhập lại mã PIN mới',
};

/** Create, change or remove the app PIN, depending on the `mode` param. */
export default function PinSetupScreen() {
  const { mode = 'create' } = useLocalSearchParams<{ mode?: Mode }>();
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
        fail('Mã PIN không đúng.');
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
        fail('Hai lần nhập không khớp. Vui lòng tạo lại.');
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
      <Stack.Screen options={{ title: TITLES[mode] }} />
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.prompt}>
          {PROMPTS[step]}
        </ThemedText>
        <ThemedText type="small" themeColor={error ? 'expense' : 'textSecondary'} style={styles.center}>
          {error || (step === 'enter' ? `Mã PIN gồm ${length} chữ số` : ' ')}
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
            {length === 6 ? 'Dùng mã 4 số' : 'Dùng mã 6 số'}
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
