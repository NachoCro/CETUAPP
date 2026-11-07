import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Etiqueta de estado: neutral (gris), ok (verde) o highlight (amarillo, para destacar). */
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'ok' | 'highlight' }) {
  const t = useTheme();
  const colors =
    tone === 'ok'
      ? { backgroundColor: t.ok, color: t.accentText }
      : tone === 'highlight'
        ? { backgroundColor: t.highlight, color: t.highlightText }
        : { backgroundColor: t.line, color: t.text };
  return <Text style={[styles.badge, colors]}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
