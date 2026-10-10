/**
 * Crewaa Royal Peacock Design Tokens (V3)
 * Dark-only palette matching frontend/app/globals.css
 */

export const PeacockColors = {
  bg: '#071A1F',
  deep: '#04121A',
  surface: '#0D252B',
  raised: '#12303A',
  line: '#1C3B43',
  text: '#EAF4F3',
  muted: '#8FB0B0',
  teal: '#26BDB0',
  onTeal: '#03201C',
  gold: '#D8B45A',
  goldHi: '#F1DA97',
  blue: '#4FB3D9',
  ok: '#86D36B',
  warn: '#F29A4A',
  danger: '#F2716B',
} as const;

export const PartColors = {
  collabs: '#26BDB0',
  grow: '#D8B45A',
  ai: '#8FA8FF',
  suite: '#EE8A6B',
  crew: '#B49CF0',
} as const;

export default {
  dark: {
    text: PeacockColors.text,
    background: PeacockColors.bg,
    tint: PeacockColors.teal,
    tabIconDefault: PeacockColors.muted,
    tabIconSelected: PeacockColors.teal,
    card: PeacockColors.surface,
    border: PeacockColors.line,
  },
  light: {
    // Crewaa is dark-only; light defaults to dark values
    text: PeacockColors.text,
    background: PeacockColors.bg,
    tint: PeacockColors.teal,
    tabIconDefault: PeacockColors.muted,
    tabIconSelected: PeacockColors.teal,
    card: PeacockColors.surface,
    border: PeacockColors.line,
  },
};
