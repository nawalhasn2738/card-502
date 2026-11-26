import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn, FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Avatar from '../Avatar';
import Anchor from './Anchor';
import { CardBack } from '../PlayingCard';
import ScoreBar from '../ScoreBar';
import { colors, fonts } from '../../ui/theme';

function ThinkingDots({ color }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => <Dot key={i} index={i} color={color} />)}
    </View>
  );
}
function Dot({ index, color }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(index * 150, withRepeat(withSequence(
      withTiming(1, { duration: 300 }), withTiming(0.3, { duration: 300 })), -1, false));
  }, [index, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: -2 * v.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const FLASH_TONES = {
  red: { bg: colors.danger, fg: '#fff' },
  blue: { bg: '#3B6FD8', fg: '#fff' },
  gold: { bg: colors.gold, fg: colors.goldInk },
  neutral: { bg: colors.navyRaised, fg: colors.text },
};

function OpponentSeat({ player, color, active, thinking, flash, registry, compact, lift = 0 }) {
  const count = player.hand.length;
  const fanCount = Math.min(count, compact ? 4 : 5);
  const miniW = compact ? 16 : 19;
  const avatar = compact ? 40 : 48;
  const out = player.eliminated;

  return (
    <View style={[styles.seat, { transform: [{ translateY: lift }] }, out && { opacity: 0.55 }]}>
      <Anchor id={`seat:${player.id}`} registry={registry}>
        <Avatar name={player.name} color={color} size={avatar} active={active} isBot={player.isBot} eliminated={out} />
      </Anchor>

      {flash && (
        <Animated.View key={flash.key} entering={ZoomIn.springify().damping(12)} exiting={FadeOut}
          style={[styles.flash, { backgroundColor: FLASH_TONES[flash.tone].bg }]}>
          <Text style={[styles.flashText, { color: FLASH_TONES[flash.tone].fg }]}>{flash.label}</Text>
        </Animated.View>
      )}

      <Text numberOfLines={1} style={[styles.name, active && { color }]}>{player.name}</Text>

      <View style={styles.handRow}>
        {out ? (
          <View style={styles.outTag}><Text style={styles.outText}>OUT</Text></View>
        ) : (
          <>
            <View style={{ width: miniW + (fanCount - 1) * 5, height: miniW * 1.42 }}>
              {Array.from({ length: fanCount }, (_, i) => (
                <View key={i} style={{ position: 'absolute', left: i * 5, transform: [{ rotate: `${(i - (fanCount - 1) / 2) * 6}deg` }] }}>
                  <CardBack width={miniW} />
                </View>
              ))}
            </View>
            <Text style={styles.count}>{count}</Text>
          </>
        )}
      </View>

      <View style={[styles.scoreRow, { width: compact ? 58 : 70 }]}>
        <ScoreBar score={player.score} height={4} />
        <Text style={styles.score}>{player.score}</Text>
      </View>

      <View style={styles.statusSlot}>
        {thinking && (
          <Animated.View entering={FadeIn} exiting={FadeOut}><ThinkingDots color={color} /></Animated.View>
        )}
      </View>
    </View>
  );
}

export default memo(OpponentSeat);

const styles = StyleSheet.create({
  seat: { alignItems: 'center', minWidth: 60 },
  name: { fontFamily: fonts.semibold, color: colors.textSoft, fontSize: 12.5, marginTop: 6, maxWidth: 76 },
  handRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, height: 28 },
  count: { fontFamily: fonts.bold, color: colors.text, fontSize: 14 },
  scoreRow: { alignItems: 'center', marginTop: 5, gap: 2 },
  score: { fontFamily: fonts.medium, color: colors.textMuted, fontSize: 10.5 },
  statusSlot: { height: 10, marginTop: 2, justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  flash: {
    position: 'absolute', top: -8, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 7,
    borderWidth: 1.5, borderColor: colors.night, zIndex: 5,
  },
  flashText: { fontFamily: fonts.black, fontSize: 10, letterSpacing: 0.6 },
  outTag: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, borderWidth: 1.2, borderColor: colors.danger,
    transform: [{ rotate: '-6deg' }],
  },
  outText: { fontFamily: fonts.black, color: colors.danger, fontSize: 12, letterSpacing: 1.5 },
});
