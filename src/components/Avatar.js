import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Icon from './Icon';
import { initials } from '../ui/players';
import { colors, fonts } from '../ui/theme';

export default function Avatar({ name, color, size = 48, active = false, isBot = false, eliminated = false }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (active) {
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }), -1, false);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [active, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: active ? 0.9 * (1 - pulse.value) : 0,
    transform: [{ scale: 1 + pulse.value * 0.38 }],
  }));

  const tint = eliminated ? '#4A5070' : color;
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: size, borderWidth: 2, borderColor: color }, ring]} />
      <View style={[styles.ring, { borderRadius: size, borderColor: active ? color : 'rgba(255,255,255,0.14)', borderWidth: active ? 2.5 : 1.5 }]}>
        <LinearGradient
          colors={[tint, shade(tint)]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={[styles.fill, { borderRadius: size }]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.36, color: eliminated ? colors.textMuted : '#10142A' }]}>
            {initials(name)}
          </Text>
        </LinearGradient>
      </View>
      {isBot && (
        <View style={[styles.botBadge, { width: size * 0.42, height: size * 0.42, borderRadius: size }]}>
          <Icon name="bot" size={size * 0.26} color={colors.textSoft} strokeWidth={2.2} />
        </View>
      )}
    </View>
  );
}

// Darken a hex colour for the gradient's lower stop.
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = 0.62;
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

const styles = StyleSheet.create({
  ring: { flex: 1, padding: 2.5, backgroundColor: 'rgba(7,10,22,0.7)' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bold, includeFontPadding: false, letterSpacing: 0.5 },
  botBadge: {
    position: 'absolute', right: -3, bottom: -3, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.navyRaised, borderWidth: 1.5, borderColor: colors.night,
  },
});
