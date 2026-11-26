import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import SuitIcon from './SuitIcon';
import { powerBadge, suitColor } from '../ui/cards';
import { colors, fonts, shadow } from '../ui/theme';

export const CARD_RATIO = 1.42;
const BADGE_TONES = {
  gold: { bg: colors.gold, fg: colors.goldInk },
  red: { bg: colors.cardRed, fg: '#fff' },
  blue: { bg: '#3B6FD8', fg: '#fff' },
};

function CardFace({ card, width }) {
  const height = width * CARD_RATIO;
  const ink = suitColor(card.suit);
  const tiny = width < 44;
  const badge = !tiny && width >= 56 ? powerBadge(card) : null;
  const isFace = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  const isSeven = card.rank === '7' && card.suit === 'hearts';
  const rankSize = width * (card.rank === '10' ? 0.24 : 0.28);
  const radius = width * 0.12;

  if (tiny) {
    return (
      <View style={[styles.face, { width, height, borderRadius: radius }]}>
        <Text style={[styles.rank, { color: ink, fontSize: width * 0.38, marginTop: width * 0.06 }]}>{card.rank}</Text>
        <SuitIcon suit={card.suit} size={width * 0.42} />
      </View>
    );
  }

  return (
    <View style={[styles.faceShell, { width, height, borderRadius: radius }]}>
      <LinearGradient
        colors={[colors.cardFace, '#FBF4E4', colors.cardFaceEdge]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <View style={[styles.innerBorder, { borderRadius: radius * 0.75, margin: width * 0.045 }]} />

      <View style={[styles.corner, { top: width * 0.06, left: width * 0.07 }]}>
        <Text style={[styles.rank, { color: ink, fontSize: rankSize, lineHeight: rankSize * 1.05 }]}>{card.rank}</Text>
        <SuitIcon suit={card.suit} size={width * 0.17} />
      </View>
      <View style={[styles.corner, styles.cornerFlip, { bottom: width * 0.06, right: width * 0.07 }]}>
        <Text style={[styles.rank, { color: ink, fontSize: rankSize, lineHeight: rankSize * 1.05 }]}>{card.rank}</Text>
        <SuitIcon suit={card.suit} size={width * 0.17} />
      </View>

      <View style={styles.center} pointerEvents="none">
        {isFace ? (
          <View style={[styles.facePanel, {
            width: width * 0.5, height: width * 0.68, borderRadius: width * 0.08, borderColor: ink,
          }]}>
            <Text style={[styles.faceLetter, { color: ink, fontSize: width * 0.36 }]}>{card.rank}</Text>
            <SuitIcon suit={card.suit} size={width * 0.16} />
          </View>
        ) : (
          <View style={isSeven ? [styles.sevenHalo, { width: width * 0.64, height: width * 0.64, borderRadius: width }] : null}>
            <SuitIcon suit={card.suit} size={width * (card.rank === 'A' ? 0.52 : 0.44)} />
          </View>
        )}
      </View>

      {badge && (
        <View style={[styles.badge, { backgroundColor: BADGE_TONES[badge.tone].bg, top: width * 0.07, right: width * 0.06 }]}>
          <Text style={[styles.badgeText, { color: BADGE_TONES[badge.tone].fg, fontSize: Math.max(7, width * 0.105) }]}>
            {badge.label}
          </Text>
        </View>
      )}
    </View>
  );
}

export const CardBack = memo(function CardBack({ width }) {
  const height = width * CARD_RATIO;
  const radius = width * 0.12;
  const detailed = width >= 40;
  return (
    <View style={[styles.faceShell, { width, height, borderRadius: radius, backgroundColor: colors.backB }]}>
      <LinearGradient
        colors={[colors.backA, colors.backB]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {detailed && (
        <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
          <Defs>
            <Pattern id="lattice" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <Line x1="0" y1="0" x2="0" y2="10" stroke={colors.gold} strokeOpacity="0.16" strokeWidth="1.2" />
            </Pattern>
          </Defs>
          <Rect x={width * 0.09} y={width * 0.09} width={width * 0.82} height={height - width * 0.18}
            rx={radius * 0.6} fill="url(#lattice)" />
        </Svg>
      )}
      <View style={[styles.backBorder, { borderRadius: radius * 0.7, margin: width * 0.06 }]} />
      {detailed && (
        <View style={styles.center}>
          <View style={[styles.emblem, { width: width * 0.56, height: width * 0.56, borderRadius: width }]}>
            <Text style={[styles.emblemText, { fontSize: width * 0.2 }]}>502</Text>
          </View>
        </View>
      )}
    </View>
  );
});

function PlayingCard({ card, width = 64, faceDown = false, style }) {
  return (
    <View style={[shadow.card, { borderRadius: width * 0.12 }, style]}>
      {faceDown || !card ? <CardBack width={width} /> : <CardFace card={card} width={width} />}
    </View>
  );
}

export default memo(PlayingCard);

const styles = StyleSheet.create({
  faceShell: { overflow: 'hidden', backgroundColor: colors.cardFace },
  face: {
    backgroundColor: colors.cardFace, alignItems: 'center', justifyContent: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.cardFaceEdge,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(27,32,51,0.08)',
  },
  corner: { position: 'absolute', alignItems: 'center' },
  cornerFlip: { transform: [{ rotate: '180deg' }] },
  rank: { fontFamily: fonts.display, includeFontPadding: false },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  facePanel: {
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(233,196,106,0.18)',
  },
  faceLetter: { fontFamily: fonts.display, includeFontPadding: false, marginBottom: -2 },
  sevenHalo: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(233,196,106,0.28)', borderWidth: 1.5, borderColor: colors.gold,
  },
  badge: { position: 'absolute', paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 4 },
  badgeText: { fontFamily: fonts.black, letterSpacing: 0.4 },
  backBorder: { ...StyleSheet.absoluteFillObject, borderWidth: 1.2, borderColor: 'rgba(233,196,106,0.55)' },
  emblem: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backB,
    borderWidth: 1.2, borderColor: colors.gold,
  },
  emblemText: { fontFamily: fonts.display, color: colors.gold, includeFontPadding: false },
});
