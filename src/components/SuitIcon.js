import Svg, { Circle, Path } from 'react-native-svg';
import { suitColor } from '../ui/cards';

// Crisp vector suits drawn on a 100×100 grid so they scale to any size.
const HEART = 'M50 90 C22 68 4 50 4 30 C4 14 16 4 30 4 C40 4 47 10 50 18 C53 10 60 4 70 4 C84 4 96 14 96 30 C96 50 78 68 50 90 Z';
const DIAMOND = 'M50 3 C60 20 74 36 90 50 C74 64 60 80 50 97 C40 80 26 64 10 50 C26 36 40 20 50 3 Z';
const SPADE = 'M50 4 C62 22 94 40 94 61 C94 75 83 84 71 84 C63 84 57 80 54 75 C55 84 59 91 67 97 L33 97 C41 91 45 84 46 75 C43 80 37 84 29 84 C17 84 6 75 6 61 C6 40 38 22 50 4 Z';
const CLUB_STEM = 'M46 58 C46 76 42 88 32 97 L68 97 C58 88 54 76 54 58 Z';

export default function SuitIcon({ suit, size = 16, color }) {
  const fill = color ?? suitColor(suit);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {suit === 'hearts' && <Path d={HEART} fill={fill} />}
      {suit === 'diamonds' && <Path d={DIAMOND} fill={fill} />}
      {suit === 'spades' && <Path d={SPADE} fill={fill} />}
      {suit === 'clubs' && (
        <>
          <Circle cx="50" cy="27" r="21" fill={fill} />
          <Circle cx="27" cy="60" r="21" fill={fill} />
          <Circle cx="73" cy="60" r="21" fill={fill} />
          <Circle cx="50" cy="52" r="12" fill={fill} />
          <Path d={CLUB_STEM} fill={fill} />
        </>
      )}
    </Svg>
  );
}
