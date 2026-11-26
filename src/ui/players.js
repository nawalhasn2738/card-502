// Display helpers for seats and setup. No game state lives here.
import { seatColors } from './theme';

export const BOT_NAMES = ['Nova', 'Blitz', 'Echo', 'Pixel', 'Atlas'];

export const humanIndex = (state) => state?.players?.findIndex((p) => !p.isBot) ?? -1;
export const seatColor = (index) => seatColors[index % seatColors.length];
export const initials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
export const findPlayer = (state, id) => state?.players?.find((p) => p.id === id);
export const playerIndex = (state, id) => state?.players?.findIndex((p) => p.id === id) ?? -1;
