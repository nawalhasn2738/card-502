import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../ui/theme';

// Bottom sheet rendered inside the screen (not a native Modal) so Reanimated
// enter/exit animations work identically on Android, iOS and web.
export default function Sheet({ visible, onClose, title, subtitle, children, dismissable = true }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={dismissable ? onClose : undefined}
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(220)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
      >
        <View style={styles.handle} />
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(3,5,14,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.glassStrong, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingTop: 10,
  },
  handle: {
    alignSelf: 'center', width: 42, height: 4.5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 14,
  },
  title: { fontFamily: fonts.display, color: colors.text, fontSize: 24, textAlign: 'center' },
  subtitle: {
    fontFamily: fonts.regular, color: colors.textMuted, fontSize: 14,
    textAlign: 'center', marginTop: 4, marginBottom: 6,
  },
});
