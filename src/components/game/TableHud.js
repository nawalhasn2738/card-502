import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown, FadeOut, FadeOutUp, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import PlayingCard from '../PlayingCard';
import SuitIcon from '../SuitIcon';
import Icon from '../Icon';
import { SUIT_SYMBOL } from '../../ui/cards';
import { colors, fonts, radius } from '../../ui/theme';

const TONES = {
  red: { border: 'rgba(255,93,110,0.7)', bg: 'rgba(120,20,36,0.55)', fg: '#FFD5DA', accent: colors.danger },
  blue: { border: 'rgba(122,180,255,0.7)', bg: 'rgba(24,52,110,0.55)', fg: '#DCEBFF', accent: colors.info },
  gold: { border: 'rgba(233,196,106,0.75)', bg: 'rgba(90,64,14,0.5)', fg: colors.goldBright, accent: colors.gold },
  neutral: { border: 'rgba(255,255,255,0.14)', bg: 'rgba(10,14,32,0.6)', fg: colors.textSoft, accent: colors.textSoft },
};

function Pulse({ children, active }) {
  const v = useSharedValue(1);
  useEffect(() => {
    if (active) v.value = withRepeat(withSequence(withTiming(1.06, { duration: 520 }), withTiming(1, { duration: 520 })), -1);
    else v.value = withTiming(1);
  }, [active, v]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

// The single most important table condition: penalty, skip, called suit, or
// the card to match.
export function StatusBanner({ state, targetName, targetIsYou }) {
  let tone = 'neutral';
  let content;
  const onWho = targetIsYou ? 'on you' : `on ${targetName}`;
  if (state.pendingDraw > 0) {
    tone = 'red';
    content = (
      <>
        <Text style={[styles.big, { color: colors.danger }]}>+{state.pendingDraw}</Text>
        <Text style={[styles.bannerText, { color: TONES.red.fg }]}>
          {state.pendingType === 'ace' ? 'Ace penalty' : 'Draw penalty'} {onWho}
        </Text>
      </>
    );
  } else if (state.pendingSkip) {
    tone = 'blue';
    content = (
      <>
        <Icon name="skip" size={18} color={colors.info} strokeWidth={2.4} />
        <Text style={[styles.bannerText, { color: TONES.blue.fg }]}>Skip {onWho} · an 8 counters</Text>
      </>
    );
  } else if (state.chosenSuit) {
    tone = 'gold';
    content = (
      <>
        <SuitIcon suit={state.chosenSuit} size={17} color={state.chosenSuit === 'hearts' || state.chosenSuit === 'diamonds' ? '#FF7A7F' : colors.text} />
        <Text style={[styles.bannerText, { color: TONES.gold.fg }]}>Suit called · follow {SUIT_SYMBOL[state.chosenSuit]}</Text>
      </>
    );
  } else {
    const top = state.discardPile[state.discardPile.length - 1];
    content = (
      <Text style={[styles.bannerText, { color: TONES.neutral.fg }]}>
        Match <Text style={styles.strong}>{SUIT_SYMBOL[top?.suit]}</Text> or <Text style={styles.strong}>{top?.rank}</Text>
      </Text>
    );
  }
  const key = `${tone}-${state.pendingDraw}-${state.pendingSkip}-${state.chosenSuit}`;
  return (
    <Pulse active={tone === 'red' && targetIsYou}>
      <Animated.View key={key} entering={ZoomIn.springify().damping(14)} exiting={FadeOut.duration(120)}
        style={[styles.banner, { borderColor: TONES[tone].border, backgroundColor: TONES[tone].bg }]}>
        {content}
      </Animated.View>
    </Pulse>
  );
}

// Brief callout of the latest event. Keyed by the event object so each new
// event animates in and the previous one floats away.
export function EventToast({ event, info }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [event]);
  if (!info || !visible) return null;
  const tone = TONES[info.tone] ?? TONES.neutral;
  return (
    <Animated.View
      key={String(event?.type) + (info.text)}
      entering={FadeInDown.springify().damping(16)}
      exiting={FadeOutUp.duration(220)}
      style={[styles.toast, { borderColor: tone.border }]}
      pointerEvents="none"
    >
      {info.card && <PlayingCard card={info.card} width={22} />}
      <Text numberOfLines={1} style={[styles.toastText, { color: tone.fg }]}>{info.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 34,
    borderRadius: radius.pill, borderWidth: 1.2,
  },
  bannerText: { fontFamily: fonts.semibold, fontSize: 13.5 },
  strong: { fontFamily: fonts.black, color: colors.text, fontSize: 15 },
  big: { fontFamily: fonts.black, fontSize: 18 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, height: 38,
    borderRadius: radius.pill, borderWidth: 1, backgroundColor: 'rgba(7,10,22,0.86)', maxWidth: '92%',
  },
  toastText: { fontFamily: fonts.semibold, fontSize: 13.5, flexShrink: 1 },
});
