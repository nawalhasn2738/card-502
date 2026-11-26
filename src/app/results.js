import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import Backdrop from '../components/Backdrop';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import PlayingCard from '../components/PlayingCard';
import ScoreBar, { dangerColor } from '../components/ScoreBar';
import { PrimaryButton } from '../components/Buttons';
import { RULES } from '../logic/constants';
import { useGame } from '../state/GameContext';
import { sortForDisplay } from '../ui/cards';
import { seatColor } from '../ui/players';
import useCountUp from '../ui/useCountUp';
import { colors, fonts, radius } from '../ui/theme';

function ResultRow({ player, index, seat, points, isWinner, eliminatedNow, sittingOut }) {
  const delay = 350 + index * 140;
  const before = player.score - (points ?? 0);
  const shownPoints = useCountUp(points ?? 0, { delay, duration: 700 });
  const shownTotal = useCountUp(player.score, { from: before, delay, duration: 900 });
  const protectedWin = isWinner && player.score >= RULES.eliminationScore;
  const cards = sortForDisplay(player.hand);
  return (
    <Animated.View entering={FadeInDown.delay(150 + index * 110).springify().damping(18)}
      style={[styles.row, isWinner && styles.rowWinner, eliminatedNow && styles.rowOut, sittingOut && { opacity: 0.45 }]}>
      <View style={styles.rowTop}>
        <Avatar name={player.name} color={seatColor(seat)} size={40} isBot={player.isBot} eliminated={player.eliminated} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameLine}>
            <Text numberOfLines={1} style={styles.name}>{player.isBot ? player.name : `${player.name} (you)`}</Text>
            {isWinner && <View style={[styles.tag, { backgroundColor: colors.gold }]}><Text style={[styles.tagText, { color: colors.goldInk }]}>WINNER</Text></View>}
            {protectedWin && (
              <View style={[styles.tag, styles.tagSafe]}>
                <Icon name="shield" size={10} color={colors.success} strokeWidth={2.6} />
                <Text style={[styles.tagText, { color: colors.success }]}>SAFE</Text>
              </View>
            )}
          </View>
          <Text style={styles.sub}>
            {sittingOut ? 'Out of the game' : cards.length === 0 ? 'Emptied hand' : `${cards.length} card${cards.length === 1 ? '' : 's'} left`}
          </Text>
        </View>
        {!sittingOut && (
          <Text style={[styles.points, { color: points ? colors.danger : colors.success }]}>
            {points ? `+${shownPoints}` : '0'}
          </Text>
        )}
      </View>

      {!sittingOut && cards.length > 0 && (
        <View style={styles.cardsRow}>
          {cards.slice(0, 14).map((c, i) => (
            <View key={c.id} style={{ marginLeft: i === 0 ? 0 : -9 }}>
              <PlayingCard card={c} width={28} />
            </View>
          ))}
          {cards.length > 14 && <Text style={styles.more}>+{cards.length - 14}</Text>}
        </View>
      )}

      <View style={styles.totalRow}>
        <View style={{ flex: 1 }}><ScoreBar score={player.score} from={before} delay={delay} height={7} /></View>
        <Text style={[styles.total, { color: dangerColor(player.score) }]}>
          {shownTotal}<Text style={styles.totalMax}> / {RULES.eliminationScore}</Text>
        </Text>
      </View>

      {eliminatedNow && (
        <Animated.View entering={ZoomIn.delay(delay + 900).springify().damping(10)} style={styles.stampWrap}>
          <View style={styles.stamp}><Text style={styles.stampText}>ELIMINATED</Text></View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

export default function Results() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const [error, setError] = useState(null);
  const requested = useRef(null);

  // Once Next Round has dealt, return to the table.
  useEffect(() => {
    if (!state) return;
    if (state.phase === 'playing') router.dismissTo('/game');
    else if (requested.current && state !== requested.current && state.lastEvent?.type === 'INVALID') {
      requested.current = null;
      setError('The deck could not be dealt. Tap again to reshuffle.');
    }
  }, [state, router]);

  if (!state) return <Redirect href="/" />;
  // Between NEXT_ROUND and the effect above navigating back to the table.
  if (!state.roundResult) return <Backdrop />;
  const result = state.roundResult;
  const winner = state.players.find((p) => p.id === result.winnerId);
  const human = state.players.find((p) => !p.isBot);
  const gameOver = state.phase === 'gameOver';
  const youWon = winner?.id === human?.id;

  const rows = state.players.map((p, seat) => ({ p, seat }))
    .sort((a, b) => {
      const ap = result.points[a.p.id];
      const bp = result.points[b.p.id];
      if (a.p.id === result.winnerId) return -1;
      if (b.p.id === result.winnerId) return 1;
      if (ap === undefined) return 1;
      if (bp === undefined) return -1;
      return ap - bp;
    });

  const next = () => {
    setError(null);
    requested.current = state;
    dispatch({ type: 'NEXT_ROUND', expectedState: state });
  };

  return (
    <Backdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
            <Text style={styles.kicker}>ROUND {state.round} RESULTS</Text>
            <Avatar name={winner?.name} color={seatColor(state.players.indexOf(winner))} size={64} isBot={winner?.isBot} active />
            <Text style={styles.title}>{youWon ? 'You won the round' : `${winner?.name} wins the round`}</Text>
            <View style={styles.reason}>
              {result.reason === 'SEVEN_OF_HEARTS' ? (
                <>
                  <PlayingCard card={{ id: '7H', rank: '7', suit: 'hearts' }} width={18} />
                  <Text style={styles.reasonText}>Finished with the 7 of Hearts</Text>
                </>
              ) : (
                <>
                  <Icon name="sparkle" size={14} color={colors.gold} />
                  <Text style={styles.reasonText}>Played every card</Text>
                </>
              )}
            </View>
            {result.eliminatedIds.length > 0 && (
              <Text style={styles.outLine}>
                {result.eliminatedIds.map((id) => state.players.find((p) => p.id === id)?.name).join(', ')}
                {result.eliminatedIds.length === 1 ? ' crossed 502 and is out' : ' crossed 502 and are out'}
              </Text>
            )}
          </Animated.View>

          <View style={{ gap: 12 }}>
            {rows.map(({ p, seat }, i) => (
              <ResultRow
                key={p.id}
                player={p}
                seat={seat}
                index={i}
                points={result.points[p.id]}
                isWinner={p.id === result.winnerId}
                eliminatedNow={result.eliminatedIds.includes(p.id)}
                sittingOut={result.points[p.id] === undefined}
              />
            ))}
          </View>
        </ScrollView>

        <Animated.View entering={FadeInDown.delay(700)} style={styles.footer}>
          {error && <Text style={styles.error}>{error}</Text>}
          {gameOver ? (
            <PrimaryButton label="See the champion" icon={<Icon name="crown" size={20} color={colors.goldInk} />}
              onPress={() => router.replace('/game-over')} />
          ) : (
            <PrimaryButton label={`Deal round ${state.round + 1}`} icon={<Icon name="shuffle" size={20} color={colors.goldInk} />}
              onPress={next} />
          )}
        </Animated.View>
      </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 30 },
  hero: { alignItems: 'center', marginBottom: 22, marginTop: 6 },
  kicker: { fontFamily: fonts.semibold, color: colors.textMuted, letterSpacing: 3, fontSize: 12, marginBottom: 16 },
  title: { fontFamily: fonts.display, color: colors.text, fontSize: 28, marginTop: 14, textAlign: 'center' },
  reason: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.pill, backgroundColor: 'rgba(233,196,106,0.1)', borderWidth: 1, borderColor: 'rgba(233,196,106,0.35)',
  },
  reasonText: { fontFamily: fonts.semibold, color: colors.goldBright, fontSize: 13 },
  outLine: { fontFamily: fonts.medium, color: colors.danger, fontSize: 13.5, marginTop: 12, textAlign: 'center' },
  row: {
    padding: 14, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  rowWinner: { borderColor: 'rgba(233,196,106,0.55)', backgroundColor: 'rgba(233,196,106,0.07)' },
  rowOut: { borderColor: 'rgba(255,93,110,0.5)', backgroundColor: 'rgba(255,93,110,0.06)' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: fonts.bold, color: colors.text, fontSize: 15.5, flexShrink: 1 },
  sub: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  tagSafe: { borderWidth: 1, borderColor: colors.success },
  tagText: { fontFamily: fonts.black, fontSize: 9, letterSpacing: 0.7 },
  points: { fontFamily: fonts.display, fontSize: 24 },
  cardsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginLeft: 52 },
  more: { fontFamily: fonts.semibold, color: colors.textMuted, fontSize: 12, marginLeft: 8 },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  total: { fontFamily: fonts.bold, fontSize: 15, minWidth: 86, textAlign: 'right' },
  totalMax: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 12 },
  stampWrap: { position: 'absolute', right: 12, bottom: 34 },
  stamp: {
    borderWidth: 2, borderColor: colors.danger, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, transform: [{ rotate: '-10deg' }], backgroundColor: 'rgba(7,10,22,0.85)',
  },
  stampText: { fontFamily: fonts.black, color: colors.danger, fontSize: 12, letterSpacing: 2 },
  footer: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: 13, textAlign: 'center', marginBottom: 10 },
});
