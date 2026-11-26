import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../ui/theme';

// Full-screen background: deep navy with soft coloured light pools.
// `tone="felt"` adds the green table glow used on the game screen.
export default function Backdrop({ tone = 'night', children }) {
  const { width, height } = useWindowDimensions();
  const felt = tone === 'felt';
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={felt ? ['#0A1430', '#081026', colors.night] : ['#111A3D', colors.ink, colors.night]}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <RadialGradient id="glowA" cx="50%" cy={felt ? '45%' : '28%'} r={felt ? '62%' : '55%'}>
            <Stop offset="0" stopColor={felt ? colors.felt : '#3B4FB8'} stopOpacity={felt ? 0.55 : 0.38} />
            <Stop offset="1" stopColor={colors.night} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glowB" cx="85%" cy="92%" r="45%">
            <Stop offset="0" stopColor={colors.goldDeep} stopOpacity="0.16" />
            <Stop offset="1" stopColor={colors.night} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#glowA)" />
        <Rect width={width} height={height} fill="url(#glowB)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.night } });
