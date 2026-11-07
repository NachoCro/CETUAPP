import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipOption<T extends string> = { value: T; label: string };

/** Fila horizontal de filtros (como en el prototipo). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: t.accent, borderColor: t.accent }
                : { backgroundColor: t.backgroundElement, borderColor: t.line },
            ]}>
            <Text style={[styles.label, { color: selected ? t.accentText : t.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, paddingVertical: Spacing.two },
  chip: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: 6, paddingHorizontal: 13 },
  label: { fontSize: 14 },
});
