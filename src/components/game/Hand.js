import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Keyframe, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import {
  GestureDetector, ScrollView, useCompetingGestures, usePanGesture, useTapGesture,
} from 'react-native-gesture-handler';
import PlayingCard, { CARD_RATIO } from '../PlayingCard';
import { longLabel } from '../../ui/cards';
import { colors } from '../../ui/theme';

const dealIn = (delay) => new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -190 }, { scale: 0.6 }, { rotate: '-14deg' }] },
  70: { opacity: 1 },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }, { rotate: '0deg' }] },
}).duration(420).delay(delay);

const HandCard = memo(function HandCard({
  card, x, rot, arc, width, playable, selected, dim, interactive, onTap, onSwipe, shakeKey, enterDelay, z,
}) {
  const lift = useSharedValue(0);
  const drag = useSharedValue(0);
  // Position is driven explicitly (not by a layout transition) so a card can
  // never be left at a stale spot when the hand changes mid-animation.
  const posX = useSharedValue(x);
  useEffect(() => {
    posX.value = withSpring(x, { damping: 18, stiffness: 180 });
  }, [x, posX]);
  const slotStyle = useAnimatedStyle(() => ({ transform: [{ translateX: posX.value }] }));
  const shake = useSharedValue(0);
  const tapRef = useRef(onTap); tapRef.current = onTap;
  const swipeRef = useRef(onSwipe); swipeRef.current = onSwipe;

  useEffect(() => {
    lift.value = withSpring(selected ? -28 : playable ? -10 : 0, { damping: 15, stiffness: 230 });
  }, [selected, playable, lift]);

  useEffect(() => {
    if (!shakeKey) return;
    shake.value = withSequence(
      withTiming(-7, { duration: 45 }), withTiming(7, { duration: 70 }),
      withTiming(-5, { duration: 60 }), withTiming(0, { duration: 50 }));
  }, [shakeKey, shake]);

  const tap = useTapGesture({
    runOnJS: true,
    enabled: interactive,
    onActivate: () => tapRef.current?.(card),
  });
  const pan = usePanGesture({
    runOnJS: true,
    enabled: interactive,
    activeOffsetY: [-10, 10],
    failOffsetX: [-14, 14],
    onUpdate: (e) => { drag.value = Math.max(-140, Math.min(0, e.translationY)); },
    onDeactivate: (e) => {
      if (e.translationY < -55 || e.velocityY < -700) swipeRef.current?.(card);
      drag.value = withSpring(0, { damping: 14 });
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: shake.value },
      { translateY: arc + lift.value + drag.value },
      { rotate: `${rot}deg` },
      { scale: drag.value < -20 ? 1.05 : 1 },
    ],
  }));

  const radius = width * 0.12;
  return (
    <Animated.View style={[styles.slot, { zIndex: selected ? 100 : z }, slotStyle]} pointerEvents="box-none">
      <Animated.View entering={enterDelay >= 0 ? dealIn(enterDelay) : undefined} pointerEvents="box-none">
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={style}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${longLabel(card)}${playable ? ', playable' : ''}${selected ? ', selected' : ''}`}
        >
          <PlayingCard card={card} width={width} />
          {dim && <View pointerEvents="none" style={[styles.dim, { borderRadius: radius }]} />}
          {playable && !selected && <View pointerEvents="none" style={[styles.playable, { borderRadius: radius }]} />}
          {selected && <View pointerEvents="none" style={[styles.selected, { borderRadius: radius + 2 }]} />}
        </Animated.View>
      </GestureDetector>
      </Animated.View>
    </Animated.View>
  );
});

// Fanned hand. Overlap tightens as the hand grows; very large hands scroll.
function Hand({ cards, width: viewport, playableIds, selectedId, myTurn, onTap, onSwipe, shake, interactive }) {
  const n = cards.length;
  const cardW = Math.round(Math.max(62, Math.min(84, viewport * 0.2)));
  const cardH = cardW * CARD_RATIO;
  const usable = viewport - 28;
  const ideal = cardW * 0.7;
  const minStep = cardW * 0.44;
  const fit = n > 1 ? (usable - cardW) / (n - 1) : ideal;
  const step = Math.max(minStep, Math.min(ideal, fit));
  const total = cardW + step * Math.max(0, n - 1);
  const scrolls = total > usable + 0.5;
  const mid = (n - 1) / 2;
  const spread = scrolls ? 0 : Math.min(4, 24 / Math.max(n, 1));
  const LIFT_ROOM = 30; // space above for selected / swiped cards
  const arcK = scrolls ? 0 : 0.7;
  const maxArc = arcK * mid * mid;

  // Stagger only when several cards arrive together (a deal or a penalty).
  const known = useRef(new Set());
  const fresh = cards.filter((c) => !known.current.has(c.id)).map((c) => c.id);
  const stagger = fresh.length > 1;
  const firstRender = known.current.size === 0;
  useEffect(() => { known.current = new Set(cards.map((c) => c.id)); }, [cards]);

  return (
    <ScrollView
      horizontal
      scrollEnabled={scrolls}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ minWidth: viewport, justifyContent: 'center', paddingHorizontal: 14 }}
      style={{ flexGrow: 0 }}
    >
      <View style={{ width: total, height: cardH + LIFT_ROOM + maxArc + 6 }}>
        {cards.map((card, i) => {
          const off = i - mid;
          const isFresh = fresh.includes(card.id);
          const order = fresh.indexOf(card.id);
          return (
            <HandCard
              key={card.id}
              card={card}
              x={i * step}
              rot={off * spread}
              arc={LIFT_ROOM + arcK * off * off}
              width={cardW}
              playable={myTurn && playableIds.has(card.id)}
              selected={selectedId === card.id}
              dim={myTurn && !playableIds.has(card.id)}
              interactive={interactive}
              onTap={onTap}
              onSwipe={onSwipe}
              shakeKey={shake?.id === card.id ? shake.key : 0}
              enterDelay={isFresh ? (stagger || firstRender ? order * 70 : 0) : -1}
              z={i}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

export default memo(Hand);

const styles = StyleSheet.create({
  slot: { position: 'absolute', top: 0, left: 0 },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,10,22,0.48)' },
  playable: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: 'rgba(233,196,106,0.85)' },
  selected: {
    position: 'absolute', left: -3, top: -3, right: -3, bottom: -3,
    borderWidth: 3, borderColor: colors.goldBright,
  },
});
