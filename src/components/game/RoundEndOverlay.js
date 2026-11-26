import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import Confetti from '../Confetti';
import Avatar from '../Avatar';
import PlayingCard from '../PlayingCard';
import { PrimaryButton } from '../Buttons';
import { colors, fonts } from '../../ui/theme';

// Short celebration between the final card and the results screen.
export default function RoundEndOverlay({ winner, winnerColor, isYou, reason, finalCard, gameOver, onContinue }) {
  const seven = reason === 'SEVEN_OF_HEARTS';
  const title = seven ? '7 of Hearts!' : isYou ? 'You went out!' : `${winner?.name} went out!`;
  const subtitle = seven
    ? `${isYou ? 'You end' : `${winner?.name} ends`} the round instantly`
    : gameOver ? 'And that settles the game' : 'Round over · counting the cards';
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.root}>
      {(isYou || seven) && <Confetti count={isYou ? 60 : 36} />}
      <Animated.View entering={ZoomIn.delay(120).springify().damping(13)} style={styles.panel}>
        {finalCard && (
          <View style={styles.cardRow}>
            <PlayingCard card={finalCard} width={76} style={{ transform: [{ rotate: '-8deg' }] }} />
          </View>
        )}
        <Avatar name={winner?.name} color={winnerColor} size={56} isBot={winner?.isBot} active />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Animated.View entering={FadeInDown.delay(500)} style={{ alignSelf: 'stretch', marginTop: 18 }}>
          <PrimaryButton label={gameOver ? 'See final standings' : 'See round results'} size="md" onPress={onContinue} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,6,16,0.72)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  panel: {
    width: '100%', maxWidth: 360, alignItems: 'center', paddingVertical: 26, paddingHorizontal: 22,
    borderRadius: 28, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: 'rgba(233,196,106,0.4)',
  },
  cardRow: { marginTop: -70, marginBottom: 14 },
  title: { fontFamily: fonts.display, color: colors.gold, fontSize: 30, marginTop: 14, textAlign: 'center' },
  subtitle: { fontFamily: fonts.regular, color: colors.textSoft, fontSize: 15, marginTop: 6, textAlign: 'center' },
});
