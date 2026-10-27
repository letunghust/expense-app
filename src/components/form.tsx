import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { CategoryIcon, type IconName } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function FormLabel({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {children}
    </ThemedText>
  );
}

export function TextField(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }, props.style]}
    />
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger';
  disabled?: boolean;
}) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary && { backgroundColor: theme.tint },
        (pressed || disabled) && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={{ color: primary ? theme.onTint : theme.expense }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Grid of icons; the selected one is drawn in `color`. */
export function IconPicker({
  icons,
  value,
  color,
  onChange,
}: {
  icons: IconName[];
  value: string;
  color: string;
  onChange: (icon: IconName) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {icons.map((icon) => (
        <Pressable key={icon} onPress={() => onChange(icon)} style={styles.iconCell} accessibilityLabel={icon}>
          <CategoryIcon icon={icon} color={icon === value ? color : theme.textSecondary} size={44} />
        </Pressable>
      ))}
    </View>
  );
}

export function ColorPicker({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {colors.map((color) => (
        <Pressable
          key={color}
          onPress={() => onChange(color)}
          accessibilityLabel={color}
          style={[styles.swatchRing, { borderColor: color === value ? theme.text : 'transparent' }]}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 16,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  button: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  iconCell: {
    padding: 2,
  },
  swatchRing: {
    borderWidth: 2,
    borderRadius: 22,
    padding: 3,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});
