import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeOut, ZoomIn, cancelAnimation, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Anchor from './Anchor';
import PlayingCard, { CardBack, CARD_RATIO } from '../PlayingCard';
import SuitIcon from '../SuitIcon';
import { SUIT_NAME } from '../../ui/cards';
import { colors, fonts, motion } from '../../ui/theme';

// Stable pseudo-random tilt per card so the pile looks naturally tossed.
const tilt = (id = '') => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return (h % 17) - 8;
};

export const DrawPile = memo(function DrawPile({ count, width, canDraw, onDraw, registry, reshuffled }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (canDraw) glow.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.25, { duration: 700 })), -1, false);
    else { cancelAnimation(glow); glow.value = withTiming(0, { duration: 200 }); }
  }, [canDraw, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const layers = Math.min(3, Math.max(count, 0));
  const height = width * CARD_RATIO;

  return (
    <View style={styles.pileCol}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={canDraw ? 'Draw a card' : `Draw pile, ${count} cards`}
        disabled={!canDraw}
        onPress={onDraw}
      >
        <Anchor id="draw" registry={registry} style={{ width: width + 6, height: height + 6 }}>
          <Animated.View pointerEvents="none" style={[styles.drawGlow, { width: width + 14, height: height + 14, borderRadius: width * 0.16 }, glowStyle]} />
          {count === 0 ? (
            <View style={[styles.empty, { width, height, borderRadius: width * 0.12 }]}>
              <Text style={styles.emptyText}>Empty</Text>
            </View>
          ) : Array.from({ length: layers }, (_, i) => (
            <View key={i} style={{ position: 'absolute', left: (layers - 1 - i) * 2, top: (layers - 1 - i) * 2 }}>
              <CardBack width={width} />
            </View>
          ))}
        </Anchor>
      </Pressable>
      <View style={styles.pileLabelRow}>
        <Text style={styles.pileLabel}>DECK</Text>
        <Text style={styles.pileCount}>{count}</Text>
      </View>
      {reshuffled && (
        <Animated.View key={reshuffled} entering={ZoomIn.springify()} exiting={FadeOut} style={styles.reshuffle}>
          <Text style={styles.reshuffleText}>RESHUFFLED</Text>
        </Animated.View>
      )}
    </View>
  );
});

function ArrivingCard({ card, width, from: fromProp }) {
  // Keyed by card id, so the arrival offset is read once when the card lands.
  const from = useRef(fromProp).current;
  const t = useSharedValue(from ? 0 : 1);
  const land = useSharedValue(1);
  const rest = tilt(card.id);
  useEffect(() => {
    if (!from) return;
    t.value = withTiming(1, { duration: motion.fly, easing: Easing.out(Easing.cubic) });
    land.value = withSequence(withTiming(1.08, { duration: motion.fly * 0.8 }), withSpring(1, { damping: 10, stiffness: 300 }));
  }, [from, t, land]);
  const dx = from?.dx ?? 0;
  const dy = from?.dy ?? 0;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx * (1 - t.value) },
      { translateY: dy * (1 - t.value) - Math.sin(t.value * Math.PI) * 30 },
      { rotate: `${rest + (1 - t.value) * 28}deg` },
      { scale: land.value * (0.82 + 0.18 * t.value) },
    ],
  }));
  return (
    <Animated.View style={[styles.layer, style]}>
      <PlayingCard card={card} width={width} />
    </Animated.View>
  );
}

export const DiscardPile = memo(function DiscardPile({ pile, width, arrival, registry, chosenSuit }) {
  const top = pile[pile.length - 1];
  const under = pile.slice(-3, -1);
  const height = width * CARD_RATIO;

  return (
    <View style={styles.pileCol}>
      <Anchor id="discard" registry={registry} style={{ width: width + 6, height: height + 6, alignItems: 'center', justifyContent: 'center' }}>
        {under.map((c) => (
          <View key={c.id} style={[styles.layer, { transform: [{ rotate: `${tilt(c.id)}deg` }] }]}>
            <PlayingCard card={c} width={width} />
          </View>
        ))}
        {top && <ArrivingCard key={top.id} card={top} width={width} from={arrival} />}
      </Anchor>
      <View style={styles.pileLabelRow}>
        <Text style={styles.pileLabel}>PILE</Text>
        <Text style={styles.pileCount}>{pile.length}</Text>
      </View>
      {chosenSuit && (
        <Animated.View key={chosenSuit + top?.id} entering={ZoomIn.springify().damping(12)} exiting={FadeOut}
          style={styles.called}>
          <SuitIcon suit={chosenSuit} size={22} color={chosenSuit === 'hearts' || chosenSuit === 'diamonds' ? '#FF6B70' : colors.text} />
          <Text style={styles.calledText}>{SUIT_NAME[chosenSuit]}</Text>
        </Animated.View>
      )}
    </View>
  );
});

export const PileSpacer = () => <Animated.View entering={FadeIn} style={{ width: 18 }} />;

const styles = StyleSheet.create({
  pileCol: { alignItems: 'center' },
  layer: { position: 'absolute' },
  drawGlow: {
    position: 'absolute', left: -7, top: -7, borderWidth: 2, borderColor: colors.gold,
    backgroundColor: 'rgba(233,196,106,0.12)',
  },
  empty: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontFamily: fonts.medium, color: colors.textMuted, fontSize: 12 },
  pileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  pileLabel: { fontFamily: fonts.semibold, color: 'rgba(245,241,230,0.5)', fontSize: 10.5, letterSpacing: 2 },
  pileCount: { fontFamily: fonts.bold, color: colors.text, fontSize: 12 },
  reshuffle: {
    position: 'absolute', top: -14, backgroundColor: colors.info, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  reshuffleText: { fontFamily: fonts.black, color: '#0B1A3A', fontSize: 9, letterSpacing: 0.8 },
  called: {
    position: 'absolute', bottom: 24, right: -30, flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.glassStrong,
    borderWidth: 1.5, borderColor: colors.gold,
  },
  calledText: { fontFamily: fonts.bold, color: colors.gold, fontSize: 12 },
});
