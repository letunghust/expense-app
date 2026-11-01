import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStrings } from '@/i18n';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

/**
 * PIN dots plus an on-screen number pad. Calls onComplete once `length`
 * digits are entered. Incrementing `errorCount` shakes the dots.
 */
export function PinPad({
  length,
  value,
  onChange,
  onComplete,
  disabled,
  errorCount = 0,
  extraKey,
}: {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete: (pin: string) => void;
  disabled?: boolean;
  errorCount?: number;
  /** Rendered in the empty bottom-left slot, e.g. a fingerprint button. */
  extraKey?: ReactNode;
}) {
  const theme = useTheme();
  const t = useStrings();
  const [shake] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (errorCount === 0) return;
    Animated.sequence(
      [12, -12, 8, -8, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 60, useNativeDriver: true }))
    ).start();
  }, [errorCount, shake]);

  const press = (digit: string) => {
    if (disabled || value.length >= length) return;
    const next = value + digit;
    onChange(next);
    if (next.length === length) onComplete(next);
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dots, { transform: [{ translateX: shake }] }]}>
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: theme.text },
              i < value.length && { backgroundColor: theme.text },
            ]}
          />
        ))}
      </Animated.View>

      <View style={[styles.pad, disabled && styles.disabled]}>
        {ROWS.map((row) => (
          <View key={row[0]} style={styles.row}>
            {row.map((digit) => (
              <Key key={digit} label={digit} onPress={() => press(digit)} disabled={disabled} />
            ))}
          </View>
        ))}
        <View style={styles.row}>
          <View style={styles.key}>{extraKey}</View>
          <Key label="0" onPress={() => press('0')} disabled={disabled} />
          <Pressable
            style={styles.key}
            onPress={() => onChange(value.slice(0, -1))}
            disabled={disabled || value.length === 0}
            accessibilityLabel={t.lock.deleteDigit}>
            <Ionicons name="backspace-outline" size={28} color={theme.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Key({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.key,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
      ]}>
      <ThemedText style={styles.keyLabel}>{label}</ThemedText>
    </Pressable>
  );
}

const KEY_SIZE = 76;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.five,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.three,
    height: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  pad: {
    gap: Spacing.three,
  },
  disabled: {
    opacity: 0.35,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLabel: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 500,
  },
});
