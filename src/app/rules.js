import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Backdrop from '../components/Backdrop';
import PlayingCard from '../components/PlayingCard';
import Icon from '../components/Icon';
import { IconButton } from '../components/Buttons';
import { colors, fonts, radius } from '../ui/theme';

const c = (rank, suit) => ({ id: rank + suit, rank, suit });

const POWER = [
  { card: c('2', 'clubs'), title: 'Two · +2', body: 'Next player draws 2 unless they stack another 2. Each stacked 2 adds two more.' },
  { card: c('A', 'spades'), title: 'Ace of Spades · +5', body: 'Next player draws 5. Any other Ace passes it on, but it never grows past 5.' },
  { card: c('8', 'diamonds'), title: 'Eight · Skip', body: 'Skips the next player. They can counter with their own 8 to skip the following player instead.' },
  { card: c('J', 'hearts'), title: 'Jack · Wild', body: 'Play on anything and call a suit. The next player must follow that suit.' },
  { card: c('7', 'hearts'), title: '7 of Hearts · Instant win', body: 'Play on anything to end the round on the spot. Cards still in your hand still count.' },
];

const POINTS = [
  ['7♥  ·  A♠', '100'],
  ['Any 2, 8 or Jack', '30'],
  ['Other Aces', '20'],
  ['10, Q, K', '10'],
  ['3–6, 9, other 7s', '5'],
];

export default function Rules() {
  const router = useRouter();
  return (
    <Backdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={{ width: 44 }} />
          <Text style={styles.headerTitle}>How to play</Text>
          <IconButton label="Close" onPress={() => router.back()}><Icon name="close" /></IconButton>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
            <Text style={styles.h2}>The goal</Text>
            <Text style={styles.p}>
              Get rid of all your cards. When a round ends, everyone adds up the cards left in their hand.
              Reach <Text style={styles.em}>502 points</Text> and you’re out. The last player still in wins.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.card}>
            <Text style={styles.h2}>Your turn</Text>
            <Text style={styles.p}>• Play one card that matches the top card’s <Text style={styles.em}>suit</Text> or <Text style={styles.em}>rank</Text>.</Text>
            <Text style={styles.p}>• Or draw one card. Drawing always ends your turn, even if the card fits.</Text>
            <Text style={styles.p}>• When a penalty or skip is waiting for you, only the matching card can answer it: a 2, an Ace or an 8.</Text>
          </Animated.View>

          <Text style={styles.section}>POWER CARDS</Text>
          {POWER.map((item, i) => (
            <Animated.View key={item.title} entering={FadeInDown.delay(140 + i * 60).duration(400)} style={styles.powerRow}>
              <PlayingCard card={item.card} width={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.powerTitle}>{item.title}</Text>
                <Text style={styles.powerBody}>{item.body}</Text>
              </View>
            </Animated.View>
          ))}

          <Text style={styles.section}>CARD VALUES</Text>
          <View style={styles.card}>
            {POINTS.map(([label, pts], i) => (
              <View key={label} style={[styles.pointRow, i > 0 && styles.pointDivider]}>
                <Text style={styles.pointLabel}>{label}</Text>
                <Text style={styles.pointValue}>{pts}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.h2}>Between rounds</Text>
            <Text style={styles.p}>• The player with the fewest points last round starts the next one.</Text>
            <Text style={styles.p}>• The round winner can’t be knocked out that round, even past 502.</Text>
            <Text style={styles.p}>• Going out on a 2 or Ace of Spades still makes the next player draw before scoring.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6 },
  headerTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 24 },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  card: {
    padding: 18, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  h2: { fontFamily: fonts.bold, color: colors.text, fontSize: 17, marginBottom: 8 },
  p: { fontFamily: fonts.regular, color: colors.textSoft, fontSize: 14.5, lineHeight: 22, marginBottom: 4 },
  em: { fontFamily: fonts.semibold, color: colors.gold },
  section: { fontFamily: fonts.semibold, color: colors.textMuted, fontSize: 12, letterSpacing: 2, marginTop: 12, marginLeft: 4 },
  powerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  powerTitle: { fontFamily: fonts.bold, color: colors.text, fontSize: 15.5 },
  powerBody: { fontFamily: fonts.regular, color: colors.textSoft, fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  pointRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  pointDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  pointLabel: { fontFamily: fonts.medium, color: colors.textSoft, fontSize: 15 },
  pointValue: { fontFamily: fonts.display, color: colors.gold, fontSize: 18 },
});
