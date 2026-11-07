import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/query';

import { Button } from './ui';

/**
 * Muestra cargando / error / vacío, o el contenido si hay datos.
 *   <ListState query={q} empty="No hay apuntes todavía">{q.data?.map(...)}</ListState>
 */
export function ListState({
  query,
  empty,
  children,
}: {
  query: { isPending: boolean; error: unknown; data?: unknown[] | null; refetch: () => unknown };
  empty: string;
  children: ReactNode;
}) {
  const t = useTheme();

  if (query.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }
  if (query.error) {
    return (
      <View style={styles.center}>
        <Text style={[styles.text, { color: t.danger }]}>{errorMessage(query.error)}</Text>
        <Button title="Reintentar" variant="ghost" onPress={() => query.refetch()} />
      </View>
    );
  }
  if (!query.data?.length) {
    return (
      <View style={styles.center}>
        <Text style={[styles.text, { color: t.textSecondary }]}>{empty}</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.five, alignItems: 'center', gap: Spacing.two },
  text: { fontSize: 15, textAlign: 'center' },
});
