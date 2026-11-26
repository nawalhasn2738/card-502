import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Sheet from './Sheet';
import SuitIcon from './SuitIcon';
import PlayingCard from './PlayingCard';
import { SUITS } from '../logic/constants';
import { SUIT_NAME, suitCounts } from '../ui/cards';
import { haptic } from '../ui/haptics';
import { colors, fonts, radius } from '../ui/theme';

function SuitOption({ suit, count, best, onPick, index }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View entering={FadeInUp.delay(60 + index * 45).springify().damping(16)} style={styles.optionWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Call ${SUIT_NAME[suit]}`}
        onPressIn={() => { scale.value = withSpring(0.94); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        onPress={() => { haptic.medium(); onPick(suit); }}
      >
        <Animated.View style={[styles.option, best && styles.optionBest, style]}>
          <SuitIcon suit={suit} size={46} color={suit === 'hearts' || suit === 'diamonds' ? '#FF6B70' : colors.text} />
          <Text style={styles.optionName}>{SUIT_NAME[suit]}</Text>
          <Text style={[styles.optionCount, best && { color: colors.gold }]}>
            {count === 0 ? 'none in hand' : `${count} in hand`}
          </Text>
          {best && <View style={styles.bestTag}><Text style={styles.bestText}>BEST</Text></View>}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// Lets the player name a suit after choosing a Jack. Shows how many of each
// suit they still hold to make the choice easy.
export default function SuitPicker({ jack, hand, onPick, onCancel }) {
  const counts = jack ? suitCounts(hand, jack.id) : {};
  const max = Math.max(0, ...Object.values(counts));
  return (
    <Sheet visible={!!jack} onClose={onCancel} title="Call a suit" subtitle="The next player must follow it">
      {jack && (
        <View style={styles.jackRow}>
          <PlayingCard card={jack} width={58} style={{ transform: [{ rotate: '-6deg' }] }} />
        </View>
      )}
      <View style={styles.grid}>
        {SUITS.map((suit, i) => (
          <SuitOption key={suit} suit={suit} index={i} count={counts[suit] ?? 0}
            best={max > 0 && counts[suit] === max} onPick={onPick} />
        ))}
      </View>
      <Pressable onPress={onCancel} style={styles.cancel} accessibilityRole="button">
        <Text style={styles.cancelText}>Keep my Jack</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  jackRow: { alignItems: 'center', marginVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginTop: 4 },
  optionWrap: { width: '48.5%' },
  option: {
    alignItems: 'center', paddingVertical: 16, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  optionBest: { borderColor: colors.gold, backgroundColor: 'rgba(233,196,106,0.1)' },
  optionName: { fontFamily: fonts.semibold, color: colors.text, fontSize: 16, marginTop: 8 },
  optionCount: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bestTag: {
    position: 'absolute', top: 8, right: 8, backgroundColor: colors.gold,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
  },
  bestText: { fontFamily: fonts.black, color: colors.goldInk, fontSize: 9, letterSpacing: 0.6 },
  cancel: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 20, marginTop: 4 },
  cancelText: { fontFamily: fonts.medium, color: colors.textMuted, fontSize: 15 },
});
