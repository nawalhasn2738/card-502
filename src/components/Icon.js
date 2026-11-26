import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../ui/theme';

// Small hand-drawn stroke icon set (24×24 grid) so the app needs no icon font.
const P = {
  back: <Path d="M15 5l-7 7 7 7" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  menu: <Path d="M4 7h16M4 12h16M4 17h10" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  play: <Path d="M8 5.5v13l10.5-6.5z" />,
  refresh: <Path d="M19 8a8 8 0 1 0 1 6M19 3v5h-5" />,
  home: <Path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" />,
  book: <Path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13" />,
  crown: <Path d="M4 18h16M5 15L3.5 7l5 4L12 5l3.5 6 5-4L19 15z" />,
  shield: <Path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z" />,
  skip: <Path d="M5 6l7 6-7 6M13 6l7 6-7 6" />,
  draw: <><Rect x="6" y="3" width="12" height="16" rx="2" /><Path d="M12 8v6M9 11h6" /></>,
  bot: <><Rect x="5" y="8" width="14" height="11" rx="3" /><Path d="M12 4v4M9 13h.01M15 13h.01" /><Circle cx="12" cy="3.5" r="1" /></>,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  check: <Path d="M5 12.5l4.5 4.5L19 7" />,
  sparkle: <Path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  shuffle: <Path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c2 0 3-1.5 4-3.5M13 9.5C14 8 15 7 17 7h3M18 4l3 3-3 3M18 14l3 3-3 3" />,
  arrowUp: <Path d="M12 19V5M6 11l6-6 6 6" />,
};

export default function Icon({ name, size = 22, color = colors.text, strokeWidth = 2, fill = 'none' }) {
  const filled = name === 'play' || name === 'sparkle';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : fill}
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </Svg>
  );
}
