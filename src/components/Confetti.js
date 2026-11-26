import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { colors } from '../ui/theme';

const PALETTE = [colors.gold, colors.goldBright, '#FF7E8A', '#7AB4FF', '#5FE3B0', '#FFFFFF'];

function Piece({ spec, height }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(spec.delay, withTiming(1, { duration: spec.duration, easing: Easing.out(Easing.quad) }));
  }, [spec, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15,
    transform: [
      { translateX: spec.drift * t.value },
      { translateY: -40 + t.value * (height + 80) },
      { rotate: `${spec.spin * t.value}deg` },
      { scaleX: 0.6 + 0.4 * Math.cos(t.value * spec.flip) },
    ],
  }));
  return (
    <Animated.View style={[styles.piece, {
      left: spec.x, width: spec.w, height: spec.h, backgroundColor: spec.color,
      borderRadius: spec.round ? spec.w : 1.5,
    }, style]} />
  );
}

// One-shot celebratory confetti burst. Remount (change `key`) to replay.
export default function Confetti({ count = 46 }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * width,
    w: 6 + Math.random() * 6,
    h: 9 + Math.random() * 9,
    round: Math.random() < 0.25,
    color: PALETTE[i % PALETTE.length],
    delay: Math.random() * 500,
    duration: 2200 + Math.random() * 1600,
    drift: (Math.random() - 0.5) * 140,
    spin: (Math.random() - 0.5) * 900,
    flip: 6 + Math.random() * 10,
  })), [count, width]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => <Piece key={p.id} spec={p} height={height} />)}
    </View>
  );
}

const styles = StyleSheet.create({ piece: { position: 'absolute', top: 0 } });
