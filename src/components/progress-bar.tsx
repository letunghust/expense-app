import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Horizontal bar filled to `ratio` (clamped to 0..1). */
export function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  const theme = useTheme();
  const width = `${Math.min(Math.max(ratio, 0), 1) * 100}%` as const;
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
