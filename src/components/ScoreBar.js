import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { RULES } from '../logic/constants';
import { colors } from '../ui/theme';

// Progress toward the 502 elimination line. Colour warms as danger grows.
export function dangerColor(score) {
  const ratio = score / RULES.eliminationScore;
  if (ratio >= 1) return colors.danger;
  if (ratio >= 0.75) return '#FF8A5B';
  if (ratio >= 0.5) return colors.warning;
  return colors.success;
}

export default function ScoreBar({ score, from = score, height = 6, delay = 0, duration = 900 }) {
  const max = RULES.eliminationScore;
  const progress = useSharedValue(Math.min(from, max) / max);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(Math.min(score, max) / max, {
      duration, easing: Easing.out(Easing.cubic),
    }));
  }, [score, delay, duration, max, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const tint = dangerColor(score);
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <Animated.View style={[styles.fill, { borderRadius: height }, fill]}>
        <LinearGradient colors={[tint, tint]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: height, opacity: 0.95 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: '100%' },
});
