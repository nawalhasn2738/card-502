import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import PlayingCard, { CARD_RATIO } from '../PlayingCard';
import { motion } from '../../ui/theme';

function Flight({ flight, onDone }) {
  const t = useSharedValue(0);
  const { from, to, width, endScale = 0.7, delay = 0 } = flight;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: motion.fly, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) scheduleOnRN(onDone, flight.id);
    }));
  }, [t, delay, flight.id, onDone]);
  const style = useAnimatedStyle(() => {
    const lift = -Math.sin(t.value * Math.PI) * 46; // gentle arc
    return {
      opacity: t.value === 0 ? 0 : t.value > 0.92 ? (1 - t.value) / 0.08 : 1,
      transform: [
        { translateX: dx * t.value },
        { translateY: dy * t.value + lift },
        { rotate: `${(flight.spin ?? 14) * t.value}deg` },
        { scale: 1 + (endScale - 1) * t.value },
      ],
    };
  });
  return (
    <Animated.View style={[styles.flight, { left: from.x - width / 2, top: from.y - (width * CARD_RATIO) / 2 }, style]}>
      <PlayingCard card={flight.card} faceDown={!flight.card} width={width} />
    </Animated.View>
  );
}

// Overlay that animates face-down cards from the deck to a player.
// `origin` is the overlay's own window offset, so coordinates line up.
export default function FlightLayer({ flights, origin, onDone }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flights.map((f) => (
        <Flight key={f.id} onDone={onDone} flight={{
          ...f,
          from: { x: f.from.x - origin.x, y: f.from.y - origin.y },
          to: { x: f.to.x - origin.x, y: f.to.y - origin.y },
        }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ flight: { position: 'absolute' } });
