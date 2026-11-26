import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import Backdrop from '../components/Backdrop';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import { IconButton, PrimaryButton } from '../components/Buttons';
import { RULES } from '../logic/constants';
import { useGame } from '../state/GameContext';
import { BOT_NAMES, seatColor } from '../ui/players';
import { haptic } from '../ui/haptics';
import { colors, fonts, radius } from '../ui/theme';

const MAX_BOTS = RULES.maxPlayers - 1;
const MIN_BOTS = RULES.minPlayers - 1;
const NAME_LIMIT = 14;

function botNamesFor(count, humanName) {
  const taken = humanName.trim().toLowerCase();
  return BOT_NAMES.filter((n) => n.toLowerCase() !== taken).concat('Orion').slice(0, count);
}

// Seats around an oval, with the human at the bottom centre.
function seatPositions(total, w, h) {
  return Array.from({ length: total }, (_, i) => {
    const angle = Math.PI / 2 + (i / total) * Math.PI * 2;
    return { x: w / 2 + Math.cos(angle) * (w / 2 - 30), y: h / 2 + Math.sin(angle) * (h / 2 - 26) };
  });
}

// A seat that springs to its spot around the mini table when the count changes.
function PreviewSeat({ x, y, name, color, isHuman }) {
  const px = useSharedValue(x);
  const py = useSharedValue(y);
  useEffect(() => {
    px.value = withSpring(x, { damping: 16, stiffness: 160 });
    py.value = withSpring(y, { damping: 16, stiffness: 160 });
  }, [x, y, px, py]);
  const pop = useSharedValue(0);
  useEffect(() => { pop.value = withSpring(1, { damping: 13, stiffness: 180 }); }, [pop]);
  const pos = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.5),
    transform: [{ translateX: px.value - 30 }, { translateY: py.value - 26 }, { scale: 0.4 + 0.6 * pop.value }],
  }));
  return (
    <Animated.View style={[styles.seat, pos]}>
      <Avatar name={name} color={color} size={isHuman ? 42 : 36} isBot={!isHuman} active={isHuman} />
      <Text numberOfLines={1} style={[styles.seatName, isHuman && { color: colors.gold }]}>{name}</Text>
    </Animated.View>
  );
}

export default function Setup() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const { width } = useWindowDimensions();
  const [name, setName] = useState('');
  const [bots, setBots] = useState(2);
  const [error, setError] = useState(null);
  const startedFrom = useRef(undefined);
  const latest = useRef(state);
  latest.current = state;

  const playerName = name.trim() || 'You';
  const botNames = botNamesFor(bots, playerName);
  const tableW = Math.min(width - 48, 340);
  const tableH = tableW * 0.62;
  const seats = seatPositions(bots + 1, tableW, tableH);

  // Navigate once the reducer has produced a freshly dealt game.
  useEffect(() => {
    if (startedFrom.current === undefined || state === startedFrom.current) return;
    if (state?.lastEvent?.type === 'ROUND_START' && state.round === 1) {
      startedFrom.current = undefined;
      router.replace('/game');
    } else if (state?.lastEvent?.type === 'INVALID') {
      startedFrom.current = undefined;
      setError('The deck could not be dealt. Tap Deal again to reshuffle.');
    }
  }, [state, router]);

  function start() {
    Keyboard.dismiss();
    setError(null);
    haptic.medium();
    const players = [{ name: playerName, isBot: false }, ...botNames.map((n) => ({ name: n, isBot: true }))];
    startedFrom.current = state;
    dispatch({ type: 'START_GAME', players });
    // A rejected start before any game exists leaves state untouched (null),
    // which produces no re-render; detect that case explicitly.
    setTimeout(() => {
      if (startedFrom.current !== undefined && latest.current === startedFrom.current) {
        startedFrom.current = undefined;
        setError('The deck could not be dealt. Tap Deal again to reshuffle.');
      }
    }, 300);
  }

  const change = (delta) => {
    const next = Math.max(MIN_BOTS, Math.min(MAX_BOTS, bots + delta));
    if (next !== bots) { haptic.tap(); setBots(next); }
  };

  return (
    <Backdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <IconButton label="Back" onPress={() => router.back()}><Icon name="back" /></IconButton>
          <Text style={styles.headerTitle}>New game</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(450)}>
            <Text style={styles.label}>YOUR NAME</Text>
            <View style={styles.inputWrap}>
              <Icon name="user" size={20} color={colors.textMuted} />
              <TextInput
                value={name}
                onChangeText={(t) => setName(t.slice(0, NAME_LIMIT))}
                placeholder="Enter your name"
                placeholderTextColor={colors.textDim}
                style={styles.input}
                returnKeyType="done"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={NAME_LIMIT}
                selectionColor={colors.gold}
              />
              <Text style={styles.counter}>{name.length}/{NAME_LIMIT}</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(90).duration(450)} style={{ marginTop: 26 }}>
            <Text style={styles.label}>OPPONENTS</Text>
            <View style={styles.stepper}>
              <IconButton label="Fewer bots" size={48} disabled={bots <= MIN_BOTS} onPress={() => change(-1)}>
                <Icon name="minus" />
              </IconButton>
              <View style={{ alignItems: 'center' }}>
                <Animated.Text key={bots} entering={ZoomIn.springify().damping(14)} style={styles.stepNumber}>{bots}</Animated.Text>
                <Text style={styles.stepCaption}>{bots === 1 ? 'bot' : 'bots'} · {bots + 1} players</Text>
              </View>
              <IconButton label="More bots" size={48} disabled={bots >= MAX_BOTS} onPress={() => change(1)}>
                <Icon name="plus" />
              </IconButton>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).duration(450)} style={[styles.tableWrap, { height: tableH + 40 }]}>
            <View style={{ width: tableW, height: tableH }}>
              <Svg width={tableW} height={tableH} style={StyleSheet.absoluteFill}>
                <Defs>
                  <RadialGradient id="feltMini" cx="50%" cy="45%" r="60%">
                    <Stop offset="0" stopColor={colors.felt} />
                    <Stop offset="1" stopColor={colors.feltDeep} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={tableW / 2} cy={tableH / 2} rx={tableW / 2 - 34} ry={tableH / 2 - 30}
                  fill="url(#feltMini)" stroke={colors.feltRim} strokeOpacity={0.7} strokeWidth={2.5} />
              </Svg>
              <Text style={[styles.tableText, { top: tableH / 2 - 10, width: tableW }]}>502</Text>
              {seats.map((pos, i) => {
                const isHuman = i === 0;
                const seatName = isHuman ? playerName : botNames[i - 1];
                return (
                  <PreviewSeat key={isHuman ? 'human' : seatName} x={pos.x} y={pos.y}
                    name={seatName} color={seatColor(i)} isHuman={isHuman} />
                );
              })}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(260).duration(450)} style={styles.facts}>
            {[
              ['7', 'cards each'],
              ['502', 'points and you’re out'],
              ['↻', 'play goes clockwise'],
            ].map(([big, small]) => (
              <View key={small} style={styles.fact}>
                <Text style={styles.factBig}>{big}</Text>
                <Text style={styles.factSmall}>{small}</Text>
              </View>
            ))}
          </Animated.View>

          <Pressable onPress={() => router.push('/rules')} style={styles.rulesLink} accessibilityRole="link">
            <Icon name="book" size={16} color={colors.gold} />
            <Text style={styles.rulesLinkText}>Quick rules & card values</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          {error && <Text style={styles.error}>{error}</Text>}
          <PrimaryButton label="Deal the cards" icon={<Icon name="shuffle" size={20} color={colors.goldInk} />} onPress={start} />
        </View>
      </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6 },
  headerTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 24 },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24 },
  label: { fontFamily: fonts.semibold, color: colors.textMuted, fontSize: 12, letterSpacing: 2, marginBottom: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 16,
    borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  input: {
    flex: 1, fontFamily: fonts.medium, fontSize: 17, color: colors.text, paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
  },
  counter: { fontFamily: fonts.regular, color: colors.textDim, fontSize: 12 },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  stepNumber: { fontFamily: fonts.display, color: colors.gold, fontSize: 40, lineHeight: 46 },
  stepCaption: { fontFamily: fonts.medium, color: colors.textMuted, fontSize: 13 },
  tableWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  tableText: {
    position: 'absolute', left: 0, textAlign: 'center', fontFamily: fonts.display,
    color: 'rgba(233,196,106,0.35)', fontSize: 18, letterSpacing: 3,
  },
  seat: { position: 'absolute', left: 0, top: 0, width: 60, alignItems: 'center' },
  seatName: { fontFamily: fonts.semibold, color: colors.textSoft, fontSize: 11, marginTop: 4, maxWidth: 70 },
  facts: { flexDirection: 'row', gap: 10, marginTop: 6 },
  fact: {
    flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  factBig: { fontFamily: fonts.display, color: colors.text, fontSize: 20 },
  factSmall: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },
  rulesLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  rulesLinkText: { fontFamily: fonts.semibold, color: colors.gold, fontSize: 14 },
  footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: 13, textAlign: 'center', marginBottom: 10 },
});
