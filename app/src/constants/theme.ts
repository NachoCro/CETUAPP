/**
 * Paleta de "CETU de bolsillo", tomada del prototipo HTML
 * (Centro de estudiantes_ prototipo de la app.html).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#101828',
    textSecondary: '#5b6678',
    background: '#f1f4fa',
    backgroundElement: '#ffffff', // tarjetas, inputs, barra de pestañas
    backgroundSelected: '#dde3ee',
    line: '#dde3ee',
    accent: '#2447f5',
    accentText: '#ffffff',
    highlight: '#ffd83d', // etiquetas destacadas (ej. "Elevada a la comisión")
    highlightText: '#3a2f00',
    ok: '#12805c',
    danger: '#c0362c',
  },
  dark: {
    text: '#eef2fb',
    textSecondary: '#9aa6bd',
    background: '#0d1220',
    backgroundElement: '#161d30',
    backgroundSelected: '#27304a',
    line: '#27304a',
    accent: '#6f8bff',
    accentText: '#0d1220',
    highlight: '#ffd83d',
    highlightText: '#3a2f00',
    ok: '#4cd2a0',
    danger: '#ff7b6e',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  input: 10,
  card: 14,
  pill: 99,
} as const;

export const MaxContentWidth = 720;
