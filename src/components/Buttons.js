import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '../ui/haptics';
import { colors, fonts, radius, shadow } from '../ui/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function usePressScale(disabled) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => { if (!disabled) scale.value = withTiming(0.96, { duration: 90 }); },
    onPressOut: () => { scale.value = withSpring(1, { damping: 12, stiffness: 260 }); },
  };
}

const VARIANTS = {
  gold: { colors: [colors.goldBright, colors.gold, colors.goldDeep], text: colors.goldInk },
  danger: { colors: ['#FF8190', colors.danger, colors.dangerDeep], text: '#fff' },
  blue: { colors: ['#9CC7FF', '#5B95F0', '#2F5FC0'], text: '#fff' },
};

export function PrimaryButton({ label, onPress, disabled, icon, variant = 'gold', size = 'lg', style, sublabel }) {
  const press = usePressScale(disabled);
  const v = VARIANTS[variant];
  const height = size === 'lg' ? 58 : size === 'md' ? 50 : 42;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => { haptic.light(); onPress?.(); }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[press.style, !disabled && shadow.glow(v.colors[1]), { opacity: disabled ? 0.42 : 1, borderRadius: radius.pill }, style]}
    >
      <LinearGradient colors={v.colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[styles.primary, { height }]}>
        <View style={styles.sheen} />
        <View style={styles.row}>
          {icon}
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.primaryText, { color: v.text, fontSize: size === 'sm' ? 15 : 17 }]}>{label}</Text>
            {sublabel ? <Text style={[styles.sub, { color: v.text }]}>{sublabel}</Text> : null}
          </View>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, icon, size = 'lg', style, tone = 'default' }) {
  const press = usePressScale(disabled);
  const height = size === 'lg' ? 56 : size === 'md' ? 48 : 40;
  const toneColor = tone === 'danger' ? colors.danger : colors.text;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => { haptic.tap(); onPress?.(); }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[press.style, styles.secondary, { height, opacity: disabled ? 0.4 : 1 }, style]}
    >
      <View style={styles.row}>
        {icon}
        <Text style={[styles.secondaryText, { color: toneColor, fontSize: size === 'sm' ? 14 : 16 }]}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

export function IconButton({ children, onPress, label, size = 44, style, disabled }) {
  const press = usePressScale(disabled);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={() => { haptic.tap(); onPress?.(); }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[press.style, styles.icon, { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.4 : 1 }, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 26, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  sheen: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '48%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryText: { fontFamily: fonts.bold, letterSpacing: 0.3 },
  sub: { fontFamily: fonts.medium, fontSize: 11, opacity: 0.75, marginTop: -1 },
  secondary: {
    borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  secondaryText: { fontFamily: fonts.semibold, letterSpacing: 0.2 },
  icon: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
});
