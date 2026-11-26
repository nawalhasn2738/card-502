import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing, FadeIn, FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Backdrop from '../components/Backdrop';
import Avatar from '../components/Avatar';
import Confetti from '../components/Confetti';
import Icon from '../components/Icon';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { RULES } from '../logic/constants';
import { useGame } from '../state/GameContext';
import { seatColor } from '../ui/players';
import { haptic } from '../ui/haptics';
import { colors, fonts, radius } from '../ui/theme';

const MEDALS = [colors.gold, '#C9D1E6', '#D08B52'];

function Halo({ size }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false);
  }, [spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.gold} stopOpacity="0.55" />
            <Stop offset="0.55" stopColor={colors.gold} stopOpacity="0.12" />
            <Stop offset="1" stopColor={colors.gold} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#halo)" />
        {Array.from({ length: 12 }, (_, i) => (
          <Rect key={i} x={size / 2 - 1.5} y={4} width={3} height={size * 0.2} rx={1.5}
            fill={colors.gold} opacity={0.22} transform={`rotate(${i * 30} ${size / 2} ${size / 2})`} />
        ))}
      </Svg>
    </Animated.View>
  );
}

export default function GameOver() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const restarting = useRef(false);

  useEffect(() => { haptic.success(); }, []);
  // After Play again deals a fresh game, return to the table.
  useEffect(() => {
    if (restarting.current && state?.phase === 'playing') {
      restarting.current = false;
      router.dismissTo('/game');
    }
  }, [state, router]);

  if (!state) return <Redirect href="/" />;
  if (state.phase !== 'gameOver') return <Backdrop />;

  const champion = state.players.find((p) => p.id === state.winnerId);
  const human = state.players.find((p) => !p.isBot);
  const youWon = champion && champion.id === human?.id;
  const standings = [...state.players]
    .map((p, seat) => ({ p, seat }))
    .sort((a, b) => (a.p.id === state.winnerId ? -1 : b.p.id === state.winnerId ? 1 : a.p.score - b.p.score));

  const playAgain = () => {
    restarting.current = true;
    dispatch({ type: 'RESTART', expectedState: state });
  };
  const changePlayers = () => { router.dismissAll(); router.push('/setup'); };

  return (
    <Backdrop>
      <Confetti count={youWon ? 80 : 40} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.Text entering={FadeIn.delay(100)} style={styles.kicker}>GAME OVER · {state.round} ROUNDS</Animated.Text>
          <View style={styles.championWrap}>
            <Halo size={240} />
            <Animated.View entering={ZoomIn.delay(250).springify().damping(11)} style={{ alignItems: 'center' }}>
              <View style={styles.crown}><Icon name="crown" size={34} color={colors.gold} strokeWidth={2} /></View>
              {champion && <Avatar name={champion.name} color={seatColor(state.players.indexOf(champion))} size={104} isBot={champion.isBot} active />}
            </Animated.View>
          </View>
          <Animated.Text entering={FadeInDown.delay(450).duration(600)} style={styles.title}>
            {youWon ? 'You win!' : champion ? `${champion.name} wins` : 'Game over'}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(560).duration(600)} style={styles.subtitle}>
            {youWon ? 'Last one standing. Beautifully played.' : 'Last player standing under 502'}
          </Animated.Text>

          <View style={styles.board}>
            {standings.map(({ p, seat }, i) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(700 + i * 100).springify().damping(18)}
                style={[styles.rowItem, i === 0 && styles.rowFirst]}>
                <Text style={[styles.rank, { color: MEDALS[i] ?? colors.textMuted }]}>{i + 1}</Text>
                <Avatar name={p.name} color={seatColor(seat)} size={36} isBot={p.isBot} eliminated={p.eliminated} />
                <Text numberOfLines={1} style={styles.name}>{p.isBot ? p.name : `${p.name} (you)`}</Text>
                <Text style={[styles.score, p.score >= RULES.eliminationScore && { color: colors.danger }]}>{p.score}</Text>
              </Animated.View>
            ))}
          </View>
        </ScrollView>

        <Animated.View entering={FadeInDown.delay(900)} style={styles.footer}>
          <PrimaryButton label="Play again" sublabel="Same players, fresh scores"
            icon={<Icon name="refresh" size={20} color={colors.goldInk} />} onPress={playAgain} />
          <View style={styles.footerRow}>
            <SecondaryButton size="md" label="Players" icon={<Icon name="user" size={18} />} onPress={changePlayers} style={{ flex: 1 }} />
            <SecondaryButton size="md" label="Home" icon={<Icon name="home" size={18} />} onPress={() => router.dismissTo('/')} style={{ flex: 1 }} />
          </View>
        </Animated.View>
      </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, alignItems: 'center', paddingBottom: 30 },
  kicker: { fontFamily: fonts.semibold, color: colors.textMuted, letterSpacing: 3, fontSize: 12, marginTop: 8 },
  championWrap: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  crown: { marginBottom: -4 },
  title: {
    fontFamily: fonts.display, color: colors.gold, fontSize: 40, textAlign: 'center',
    textShadowColor: 'rgba(233,196,106,0.4)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 },
  },
  subtitle: { fontFamily: fonts.regular, color: colors.textSoft, fontSize: 15, marginTop: 6, textAlign: 'center' },
  board: { alignSelf: 'stretch', marginTop: 26, gap: 8 },
  rowItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  rowFirst: { borderColor: 'rgba(233,196,106,0.6)', backgroundColor: 'rgba(233,196,106,0.09)' },
  rank: { fontFamily: fonts.display, fontSize: 20, width: 20, textAlign: 'center' },
  name: { flex: 1, fontFamily: fonts.semibold, color: colors.text, fontSize: 15 },
  score: { fontFamily: fonts.bold, color: colors.textSoft, fontSize: 15 },
  footer: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, gap: 10 },
  footerRow: { flexDirection: 'row', gap: 10 },
});
