import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing, FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat,
  withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Backdrop from '../components/Backdrop';
import PlayingCard from '../components/PlayingCard';
import Icon from '../components/Icon';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { useGame } from '../state/GameContext';
import { colors, fonts } from '../ui/theme';

const HERO = [
  { id: '2C', rank: '2', suit: 'clubs' },
  { id: '8D', rank: '8', suit: 'diamonds' },
  { id: 'JS', rank: 'J', suit: 'spades' },
  { id: 'AS', rank: 'A', suit: 'spades' },
  { id: '7H', rank: '7', suit: 'hearts' },
];

function HeroCard({ card, index, total, width }) {
  const spread = useSharedValue(0);
  const center = (total - 1) / 2;
  const offset = index - center;
  useEffect(() => {
    spread.value = withDelay(250 + index * 70, withSpring(1, { damping: 13, stiffness: 120 }));
  }, [index, spread]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset * width * 0.6 * spread.value },
      { translateY: offset * offset * 7 * spread.value + (1 - spread.value) * 40 },
      { rotate: `${offset * 10 * spread.value}deg` },
    ],
    opacity: Math.min(1, spread.value * 1.6),
  }));
  return (
    <Animated.View style={[styles.heroCard, { zIndex: index }, style]}>
      <PlayingCard card={card} width={width} />
    </Animated.View>
  );
}

export default function Home() {
  const router = useRouter();
  const { state } = useGame();
  const { width, height } = useWindowDimensions();
  const cardW = Math.min(96, width * 0.22);
  const compact = height < 700;

  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withSequence(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
    ), -1, false);
  }, [float]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * float.value }] }));

  const canContinue = !!state && state.phase !== 'gameOver';

  return (
    <Backdrop>
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <Animated.View style={[styles.hero, { height: cardW * 1.9 }, floatStyle]}>
            {HERO.map((card, i) => (
              <HeroCard key={card.id} card={card} index={i} total={HERO.length} width={cardW} />
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(450).duration(700)} style={styles.titleBlock}>
            <Text
              style={[styles.title, compact && { fontSize: 84, lineHeight: 92 }]}
              onLongPress={__DEV__ ? () => router.push('/debug') : undefined}
            >
              502
            </Text>
            <View style={styles.subRow}>
              <View style={styles.rule} />
              <Text style={styles.subtitle}>THE CARD GAME</Text>
              <View style={styles.rule} />
            </View>
            <Text style={styles.tagline}>Empty your hand. Stay under 502.{'\n'}Last player standing wins.</Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(700).duration(600)} style={styles.actions}>
          {canContinue && (
            <PrimaryButton
              label="Continue game"
              sublabel={`Round ${state.round} in progress`}
              icon={<Icon name="play" size={18} color={colors.goldInk} />}
              onPress={() => router.push('/game')}
            />
          )}
          {canContinue ? (
            <SecondaryButton label="New game" icon={<Icon name="plus" size={18} />} onPress={() => router.push('/setup')} />
          ) : (
            <PrimaryButton
              label="Play vs Bots"
              icon={<Icon name="play" size={18} color={colors.goldInk} />}
              onPress={() => router.push('/setup')}
            />
          )}
          <SecondaryButton label="How to play" icon={<Icon name="book" size={18} />} onPress={() => router.push('/rules')} />
          <Text style={styles.footer}>2–6 players · one 52-card deck · 7 cards each</Text>
        </Animated.View>
      </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  heroCard: { position: 'absolute' },
  titleBlock: { alignItems: 'center' },
  title: {
    fontFamily: fonts.display, fontSize: 104, lineHeight: 112, color: colors.gold, letterSpacing: 2,
    textShadowColor: 'rgba(233,196,106,0.45)', textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 },
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  rule: { width: 34, height: 1, backgroundColor: 'rgba(233,196,106,0.5)' },
  subtitle: { fontFamily: fonts.semibold, color: colors.textSoft, letterSpacing: 5, fontSize: 13 },
  tagline: {
    fontFamily: fonts.regular, color: colors.textMuted, fontSize: 15, textAlign: 'center',
    marginTop: 16, lineHeight: 22,
  },
  actions: { gap: 12, paddingBottom: 12 },
  footer: { fontFamily: fonts.regular, color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 6 },
});
