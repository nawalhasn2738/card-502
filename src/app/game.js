import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import Backdrop from '../components/Backdrop';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import ScoreBar from '../components/ScoreBar';
import Sheet from '../components/Sheet';
import SuitPicker from '../components/SuitPicker';
import { IconButton, PrimaryButton, SecondaryButton } from '../components/Buttons';
import Anchor from '../components/game/Anchor';
import FlightLayer from '../components/game/FlightLayer';
import Hand from '../components/game/Hand';
import OpponentSeat from '../components/game/OpponentSeat';
import RoundEndOverlay from '../components/game/RoundEndOverlay';
import { DiscardPile, DrawPile } from '../components/game/Piles';
import { EventToast, StatusBanner } from '../components/game/TableHud';

import useBotTurns from '../hooks/useBotTurns';
import { getPlayableCards, topCard } from '../logic/rules';
import { handPoints } from '../logic/scoring';
import { RULES } from '../logic/constants';
import { createActionGuard } from '../state/actionGuard';
import { useGame } from '../state/GameContext';
import { shortLabel, sortForDisplay } from '../ui/cards';
import { describeEvent, turnHint } from '../ui/events';
import { haptic } from '../ui/haptics';
import { findPlayer, humanIndex, seatColor } from '../ui/players';
import { colors, fonts, radius } from '../ui/theme';

const EMPTY = new Set();

export default function Game() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  useBotTurns(); // the single place bot turns are scheduled
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const registry = useRef({});
  const rootRef = useRef(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const guard = useRef(null);
  if (!guard.current) guard.current = createActionGuard();

  const [selectedId, setSelectedId] = useState(null);
  const [jackCard, setJackCard] = useState(null);
  const [menu, setMenu] = useState(null); // null | 'menu' | 'restart'
  const [shake, setShake] = useState(null);
  const [nudge, setNudge] = useState(null);
  const [flights, setFlights] = useState([]);
  const [flashes, setFlashes] = useState({});
  const [reshuffled, setReshuffled] = useState(0);
  const [overlayFor, setOverlayFor] = useState(null);
  const [tableSize, setTableSize] = useState(null);
  const prevState = useRef(state);

  // ----- derived view data (read-only from game state) -----
  const hIdx = humanIndex(state);
  const human = state?.players?.[hIdx];
  const playing = state?.phase === 'playing';
  const myTurn = !!state && playing && state.currentPlayer === hIdx && !human?.eliminated;
  const playable = useMemo(() => (myTurn ? getPlayableCards(state, hIdx) : []), [state, hIdx, myTurn]);
  const playableIds = useMemo(() => (playable.length ? new Set(playable.map((c) => c.id)) : EMPTY), [playable]);
  const hand = useMemo(() => (human ? sortForDisplay(human.hand) : []), [human]);
  const selected = myTurn && playableIds.has(selectedId) ? selectedId : null;
  const selectedCard = selected ? hand.find((c) => c.id === selected) : null;

  const opponents = useMemo(() => {
    if (!state) return [];
    const n = state.players.length;
    return Array.from({ length: n - 1 }, (_, k) => (hIdx + 1 + k) % n).map((i) => ({ player: state.players[i], index: i }));
  }, [state, hIdx]);
  const current = state?.players?.[state.currentPlayer];
  const botThinking = playing && current?.isBot && !current.eliminated;
  const roundDone = !!state && !playing;

  // ----- measuring the overlay origin for card flights -----
  const measureRoot = useCallback(() => {
    requestAnimationFrame(() => rootRef.current?.measureInWindow?.((x, y) => setOrigin({ x, y })));
  }, []);

  // ----- reacting to each new engine event -----
  useEffect(() => {
    const prev = prevState.current;
    prevState.current = state;
    if (!state || !prev || prev === state) return;
    const ev = state.lastEvent;
    if (!ev || ev === prev.lastEvent) return;
    const humanId = human?.id;
    const reg = registry.current;
    const flash = (playerId, label, tone) => {
      const key = `${playerId}-${Date.now()}`;
      setFlashes((f) => ({ ...f, [playerId]: { key, label, tone } }));
      setTimeout(() => setFlashes((f) => (f[playerId]?.key === key ? { ...f, [playerId]: undefined } : f)), 1500);
    };
    const fly = (playerId, count) => {
      const from = reg.draw;
      const to = playerId === humanId ? reg.hand : reg[`seat:${playerId}`];
      if (!from || !to) return;
      const stamp = Date.now();
      const items = Array.from({ length: Math.min(count, 6) }, (_, i) => ({
        id: `${stamp}-${i}`, from, to, width: 54, delay: i * 75, card: null,
        spin: playerId === humanId ? -10 : 14, endScale: playerId === humanId ? 1.1 : 0.45,
      }));
      setFlights((f) => [...f, ...items]);
    };

    if (state.round === prev.round && state.drawPile.length > prev.drawPile.length && ev.type !== 'ROUND_START') {
      setReshuffled(Date.now());
    }

    switch (ev.type) {
      case 'DRAW':
        fly(ev.playerId, 1); // drawn cards stay face down in flight
        if (ev.playerId === humanId) haptic.light();
        break;
      case 'PENALTY_DRAW':
        fly(ev.playerId, ev.count);
        flash(ev.playerId, `+${ev.count}`, 'red');
        if (ev.playerId === humanId) haptic.heavy();
        break;
      case 'SKIP':
        flash(ev.playerId, 'SKIPPED', 'blue');
        break;
      case 'PLAY':
        if (ev.skippedId) {
          flash(ev.skippedId, 'SKIPPED', 'blue');
          if (ev.skippedId === humanId) haptic.warning();
        }
        if (ev.card.rank === 'J' && ev.chosenSuit && ev.playerId !== humanId) flash(ev.playerId, 'WILD', 'gold');
        if (ev.playerId !== humanId && (state.pendingDraw > 0 || state.pendingSkip) && state.currentPlayer === hIdx) haptic.warning();
        break;
      case 'ROUND_END': {
        // A final 2 / Ace makes the next player draw before scoring.
        state.players.forEach((p, i) => {
          const before = prev.players[i]?.hand.length ?? 0;
          if (p.id !== ev.endedBy && p.hand.length > before) fly(p.id, p.hand.length - before);
        });
        if (ev.winnerId === humanId) haptic.success(); else haptic.medium();
        break;
      }
      case 'ROUND_START':
        setFlights([]);
        setFlashes({});
        break;
      case 'INVALID':
        haptic.error();
        break;
      default:
        break;
    }
    // A gentle tap when the turn comes back to you.
    if (state.phase === 'playing' && state.currentPlayer === hIdx && prev.currentPlayer !== hIdx && !human?.eliminated) {
      haptic.light();
    }
  }, [state, human, hIdx]);

  // Let the final card land before the round-over overlay appears.
  useEffect(() => {
    if (!roundDone || overlayFor === state.roundResult) return undefined;
    const t = setTimeout(() => setOverlayFor(state.roundResult), 650);
    return () => clearTimeout(t);
  }, [roundDone, state, overlayFor]);

  // Clear transient selection whenever it stops being valid.
  useEffect(() => { if (!myTurn) { setSelectedId(null); setJackCard(null); } }, [myTurn]);
  useEffect(() => {
    if (!nudge) return undefined;
    const t = setTimeout(() => setNudge(null), 1800);
    return () => clearTimeout(t);
  }, [nudge]);

  // Android back opens the pause menu instead of leaving the table.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (jackCard) setJackCard(null);
      else if (menu) setMenu(null);
      else setMenu('menu');
      return true;
    });
    return () => sub.remove();
  }, [jackCard, menu]));

  // ----- actions: always through the shared guarded dispatch -----
  const send = useCallback((action) => {
    if (!guard.current()) return false;
    dispatch({ ...action, expectedState: state });
    return true;
  }, [dispatch, state]);

  const playCard = useCallback((card) => {
    if (card.rank === 'J') { haptic.tap(); setJackCard(card); return; }
    if (send({ type: 'PLAY_CARD', cardId: card.id })) {
      haptic.medium();
      setSelectedId(null);
    }
  }, [send]);

  const reject = useCallback((card, message) => {
    haptic.warning();
    setShake({ id: card.id, key: Date.now() });
    setNudge(message);
  }, []);

  const onTapCard = useCallback((card) => {
    if (!myTurn) { reject(card, playing ? `Wait for ${current?.name ?? 'your turn'}…` : 'The round is over'); return; }
    if (!playableIds.has(card.id)) { reject(card, `${shortLabel(card)} doesn’t fit · ${turnHint(state, playable.length)}`); return; }
    if (selectedId === card.id) playCard(card);
    else { haptic.tap(); setSelectedId(card.id); }
  }, [myTurn, playableIds, selectedId, playCard, reject, playing, current, state, playable.length]);

  const onSwipeCard = useCallback((card) => {
    if (myTurn && playableIds.has(card.id)) playCard(card);
    else onTapCard(card);
  }, [myTurn, playableIds, playCard, onTapCard]);

  const pickSuit = (suit) => {
    if (!jackCard) return;
    if (send({ type: 'PLAY_CARD', cardId: jackCard.id, chosenSuit: suit })) {
      setJackCard(null);
      setSelectedId(null);
    }
  };
  const draw = () => { if (send({ type: 'DRAW' })) setSelectedId(null); };
  const acceptSkip = () => { if (send({ type: 'PASS' })) haptic.tap(); };
  const restart = () => {
    setMenu(null);
    setOverlayFor(null);
    send({ type: 'RESTART' });
  };
  const leave = () => { setMenu(null); router.dismissTo('/'); };
  const toResults = () => router.push('/results');

  const removeFlight = useCallback((id) => setFlights((f) => f.filter((x) => x.id !== id)), []);

  if (!state || !human) return <Redirect href="/" />;

  // ----- discard arrival offset for the newest top card -----
  const ev = state.lastEvent;
  const actorId = ev?.type === 'PLAY' ? ev.playerId : ev?.type === 'ROUND_END' ? ev.endedBy : null;
  let arrival = null;
  if (actorId) {
    const src = actorId === human.id ? registry.current.hand : registry.current[`seat:${actorId}`];
    const dst = registry.current.discard;
    if (src && dst) arrival = { dx: src.x - dst.x, dy: src.y - dst.y };
  }

  const compactSeats = opponents.length >= 4;
  const small = height < 740;
  const pileW = small ? 66 : 78;
  const mid = (opponents.length - 1) / 2;
  const target = current;
  const toast = describeEvent(ev, state, human.id);
  const hint = myTurn
    ? (nudge ?? turnHint(state, playable.length))
    : roundDone ? 'Round over'
      : human.eliminated ? 'You’re out · watching the table'
        : nudge ?? `${current?.name} is thinking…`;
  const activeLeft = state.players.filter((p) => !p.eliminated).length;
  const canDraw = myTurn && !state.pendingSkip;
  const noPlay = myTurn && playable.length === 0;
  const winner = findPlayer(state, state.roundResult?.winnerId);
  const winnerIdx = state.players.findIndex((p) => p.id === winner?.id);

  let leftAction;
  if (myTurn && state.pendingSkip) {
    leftAction = <PrimaryButton variant="blue" size="md" label="Accept skip" icon={<Icon name="skip" size={18} color="#fff" />} onPress={acceptSkip} style={styles.actionBtn} />;
  } else if (myTurn && state.pendingDraw > 0) {
    leftAction = <PrimaryButton variant="danger" size="md" label={`Take ${state.pendingDraw}`} icon={<Icon name="draw" size={18} color="#fff" />} onPress={draw} style={styles.actionBtn} />;
  } else if (noPlay) {
    leftAction = <PrimaryButton size="md" label="Draw a card" icon={<Icon name="draw" size={18} color={colors.goldInk} />} onPress={draw} style={styles.actionBtn} />;
  } else {
    leftAction = <SecondaryButton size="md" label="Draw" icon={<Icon name="draw" size={18} />} disabled={!canDraw} onPress={draw} style={styles.actionBtn} />;
  }

  return (
    <Backdrop tone="felt">
      <View ref={rootRef} collapsable={false} onLayout={measureRoot} style={[styles.root, { paddingTop: insets.top + 4 }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <IconButton label="Game menu" onPress={() => setMenu('menu')}><Icon name="menu" /></IconButton>
          <View style={styles.roundBlock}>
            <Text style={styles.roundLabel}>ROUND</Text>
            <Animated.Text key={state.round} entering={ZoomIn.springify()} style={styles.roundNumber}>{state.round}</Animated.Text>
          </View>
          <View style={styles.leftChip}>
            <Text style={styles.leftChipNum}>{activeLeft}</Text>
            <Text style={styles.leftChipText}>in play</Text>
          </View>
        </View>

        {/* Opponents in an arc, in clockwise turn order after you */}
        <View style={styles.seats}>
          {opponents.map(({ player, index }, i) => {
            const off = mid === 0 ? 0 : (i - mid) / mid;
            return (
              <OpponentSeat
                key={player.id}
                player={player}
                color={seatColor(index)}
                active={playing && state.currentPlayer === index}
                thinking={botThinking && state.currentPlayer === index}
                flash={flashes[player.id]}
                registry={registry}
                compact={compactSeats}
                lift={opponents.length > 2 ? -(1 - off * off) * (compactSeats ? 10 : 16) : 0}
              />
            );
          })}
        </View>

        {/* Felt table with the piles */}
        <View style={styles.table} onLayout={(e) => { const l = e.nativeEvent.layout; if (l.height > 60) setTableSize(l); }}>
          {tableSize?.height > 60 && tableSize.width > 60 && <TableFelt width={tableSize.width} height={Math.min(tableSize.height - 4, tableSize.width * 0.95)} />}
          <View style={styles.bannerRow}>
            {playing && <StatusBanner state={state} targetName={target?.name} targetIsYou={state.currentPlayer === hIdx} />}
          </View>
          <View style={styles.piles}>
            <DrawPile count={state.drawPile.length} width={pileW} canDraw={canDraw} onDraw={draw}
              registry={registry} reshuffled={reshuffled || null} />
            <View style={styles.direction}>
              <Text style={styles.directionText}>↻</Text>
            </View>
            <DiscardPile pile={state.discardPile} width={pileW} arrival={arrival} registry={registry}
              chosenSuit={playing ? state.chosenSuit : null} />
          </View>
          <View style={styles.toastRow}>
            <EventToast event={ev} info={toast} />
          </View>
        </View>

        {/* You */}
        <View style={[styles.me, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Animated.Text key={hint} entering={FadeIn.duration(220)} numberOfLines={1}
            style={[styles.hint, myTurn && { color: nudge ? colors.warning : colors.goldBright }]}>
            {hint}
          </Animated.Text>

          <View style={[styles.meStrip, myTurn && styles.meStripActive]}>
            <Avatar name={human.name} color={seatColor(hIdx)} size={36} active={myTurn} eliminated={human.eliminated} />
            <View style={{ flex: 1 }}>
              <View style={styles.meTop}>
                <Text numberOfLines={1} style={styles.meName}>{human.name}</Text>
                {myTurn && (
                  <Animated.View entering={ZoomIn.springify()} style={styles.turnChip}>
                    <Text style={styles.turnChipText}>YOUR TURN</Text>
                  </Animated.View>
                )}
                {flashes[human.id] && (
                  <Animated.View key={flashes[human.id].key} entering={ZoomIn.springify()}
                    style={[styles.turnChip, { backgroundColor: flashes[human.id].tone === 'red' ? colors.danger : colors.info }]}>
                    <Text style={[styles.turnChipText, { color: '#fff' }]}>{flashes[human.id].label}</Text>
                  </Animated.View>
                )}
              </View>
              <View style={styles.meBarRow}>
                <View style={{ flex: 1 }}><ScoreBar score={human.score} height={5} /></View>
                <Text style={styles.meScore}>{human.score}<Text style={styles.meScoreMax}>/{RULES.eliminationScore}</Text></Text>
              </View>
            </View>
            {!human.eliminated && (
              <View style={styles.handValue}>
                <Text style={styles.handValueNum}>{handPoints(human.hand)}</Text>
                <Text style={styles.handValueLabel}>in hand</Text>
              </View>
            )}
          </View>

          {human.eliminated ? (
            <Animated.View entering={FadeInDown} style={styles.spectator}>
              <Text style={styles.spectatorTitle}>You’re out of this game</Text>
              <Text style={styles.spectatorText}>The bots will play on until one is left standing.</Text>
              <View style={styles.actions}>
                <SecondaryButton size="md" label="Leave" icon={<Icon name="home" size={18} />} onPress={leave} style={styles.actionBtn} />
                <PrimaryButton size="md" label="New deal" icon={<Icon name="refresh" size={18} color={colors.goldInk} />} onPress={() => setMenu('restart')} style={styles.actionBtn} />
              </View>
            </Animated.View>
          ) : (
            <>
              <Anchor id="hand" registry={registry}>
                <Hand
                  cards={hand}
                  width={width}
                  playableIds={playableIds}
                  selectedId={selected}
                  myTurn={myTurn}
                  interactive={playing}
                  onTap={onTapCard}
                  onSwipe={onSwipeCard}
                  shake={shake}
                />
              </Anchor>
              <View style={styles.actions}>
                {leftAction}
                <PrimaryButton
                  size="md"
                  label={selectedCard ? `Play ${shortLabel(selectedCard)}` : 'Play'}
                  sublabel={selectedCard ? undefined : myTurn ? (playable.length ? 'tap a glowing card' : undefined) : undefined}
                  icon={<Icon name="arrowUp" size={18} color={colors.goldInk} strokeWidth={2.4} />}
                  disabled={!selectedCard}
                  onPress={() => selectedCard && playCard(selectedCard)}
                  style={styles.actionBtn}
                />
              </View>
            </>
          )}
        </View>

        <FlightLayer flights={flights} origin={origin} onDone={removeFlight} />

        {roundDone && overlayFor === state.roundResult && (
          <RoundEndOverlay
            winner={winner}
            winnerColor={seatColor(Math.max(0, winnerIdx))}
            isYou={winner?.id === human.id}
            reason={state.roundResult?.reason}
            finalCard={topCard(state)}
            gameOver={state.phase === 'gameOver'}
            onContinue={toResults}
          />
        )}

        <SuitPicker jack={jackCard} hand={human.hand} onPick={pickSuit} onCancel={() => setJackCard(null)} />

        <Sheet visible={menu === 'menu'} onClose={() => setMenu(null)} title="Paused" subtitle={`Round ${state.round} · your game is kept if you leave`}>
          <View style={styles.menuList}>
            <PrimaryButton label="Resume" icon={<Icon name="play" size={18} color={colors.goldInk} />} onPress={() => setMenu(null)} />
            <SecondaryButton label="How to play" icon={<Icon name="book" size={18} />} onPress={() => { setMenu(null); router.push('/rules'); }} />
            <SecondaryButton label="Restart game" icon={<Icon name="refresh" size={18} />} onPress={() => setMenu('restart')} />
            <SecondaryButton label="Leave to home" icon={<Icon name="home" size={18} />} onPress={leave} />
          </View>
        </Sheet>
        <Sheet visible={menu === 'restart'} onClose={() => setMenu(null)} title="Restart the game?" subtitle="Scores reset and everyone is dealt back in.">
          <View style={styles.menuList}>
            <PrimaryButton variant="danger" label="Restart" icon={<Icon name="refresh" size={18} color="#fff" />} onPress={restart} />
            <SecondaryButton label="Cancel" onPress={() => setMenu(null)} />
          </View>
        </Sheet>
      </View>
    </Backdrop>
  );
}

function TableFelt({ width, height }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="felt" cx="50%" cy="42%" r="62%">
            <Stop offset="0" stopColor="#13805F" />
            <Stop offset="0.7" stopColor={colors.felt} />
            <Stop offset="1" stopColor={colors.feltDeep} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2 - 3} ry={height / 2 - 3}
          fill="#2A1D0C" stroke={colors.feltRim} strokeOpacity={0.55} strokeWidth={2} />
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2 - 11} ry={height / 2 - 11} fill="url(#felt)" />
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2 - 24} ry={height / 2 - 24}
          fill="none" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={1.2} strokeDasharray="4 6" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  roundBlock: { alignItems: 'center' },
  roundLabel: { fontFamily: fonts.semibold, color: colors.textMuted, fontSize: 10.5, letterSpacing: 3 },
  roundNumber: { fontFamily: fonts.display, color: colors.gold, fontSize: 26, lineHeight: 30 },
  leftChip: {
    minWidth: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  leftChipNum: { fontFamily: fonts.bold, color: colors.text, fontSize: 15, lineHeight: 17 },
  leftChipText: { fontFamily: fonts.medium, color: colors.textMuted, fontSize: 8.5 },
  seats: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start', paddingHorizontal: 8, marginTop: 18 },
  table: { flex: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10, marginVertical: 6, minHeight: 250 },
  bannerRow: { height: 40, justifyContent: 'center', marginBottom: 10 },
  piles: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  direction: { alignItems: 'center', justifyContent: 'center', width: 26 },
  directionText: { color: 'rgba(245,241,230,0.3)', fontSize: 22 },
  toastRow: { height: 42, justifyContent: 'center', alignItems: 'center', marginTop: 8, width: '100%' },
  me: { paddingTop: 2 },
  hint: { fontFamily: fonts.semibold, color: colors.textMuted, fontSize: 13.5, textAlign: 'center', marginBottom: 8, paddingHorizontal: 20 },
  meStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: radius.lg, backgroundColor: 'rgba(10,14,32,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  meStripActive: { borderColor: 'rgba(233,196,106,0.55)', backgroundColor: 'rgba(40,32,12,0.55)' },
  meTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meName: { fontFamily: fonts.bold, color: colors.text, fontSize: 15, flexShrink: 1 },
  turnChip: { backgroundColor: colors.gold, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  turnChipText: { fontFamily: fonts.black, color: colors.goldInk, fontSize: 9.5, letterSpacing: 0.8 },
  meBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  meScore: { fontFamily: fonts.bold, color: colors.text, fontSize: 12.5 },
  meScoreMax: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 11 },
  handValue: { alignItems: 'center', paddingLeft: 10, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(255,255,255,0.15)' },
  handValueNum: { fontFamily: fonts.display, color: colors.text, fontSize: 18, lineHeight: 21 },
  handValueLabel: { fontFamily: fonts.medium, color: colors.textMuted, fontSize: 9.5 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 2 },
  actionBtn: { flex: 1 },
  spectator: { marginHorizontal: 16, marginTop: 14, padding: 18, borderRadius: radius.lg, backgroundColor: 'rgba(255,93,110,0.08)', borderWidth: 1, borderColor: 'rgba(255,93,110,0.3)' },
  spectatorTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 20, textAlign: 'center' },
  spectatorText: { fontFamily: fonts.regular, color: colors.textSoft, fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  menuList: { gap: 10, marginTop: 14 },
});
