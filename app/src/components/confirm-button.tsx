import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Button } from './ui';

/**
 * Botón con confirmación en dos pasos (Alert.alert no muestra botones en web).
 * Primer toque: muestra la pregunta; segundo: ejecuta.
 */
export function ConfirmButton({
  title,
  question,
  onConfirm,
  loading,
  disabled,
}: {
  title: string;
  question: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return <Button title={title} variant="ghost" onPress={() => setAsking(true)} loading={loading} disabled={disabled} />;
  }
  return (
    <View style={styles.box}>
      <Text style={[styles.question, { color: t.text }]}>{question}</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title="Cancelar" variant="ghost" onPress={() => setAsking(false)} />
        </View>
        <View style={styles.flex}>
          <Button
            title="Sí, confirmar"
            onPress={() => {
              setAsking(false);
              onConfirm();
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 8 },
  question: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
