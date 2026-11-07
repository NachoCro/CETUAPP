import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ListState } from '@/components/list-state';
import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { notificationHref, useNotifications } from '@/hooks/use-notifications';
import type { AppNotification } from '@/lib/types';

const dateFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function NotificacionesScreen() {
  const { query, unread, markRead } = useNotifications();

  function open(n: AppNotification) {
    if (!n.read_at) markRead.mutate([n.id]);
    const href = notificationHref(n);
    if (href) router.push(href);
  }

  return (
    <Screen title="Notificaciones" hideVerificationBanner>
      {unread > 0 ? (
        <Button title="Marcar todas como leídas" variant="ghost" onPress={() => markRead.mutate('all')} loading={markRead.isPending} />
      ) : null}
      <ListState query={query} empty="No tenés notificaciones.">
        {query.data?.map((n) => <NotificationItem key={n.id} n={n} onPress={() => open(n)} />)}
      </ListState>
    </Screen>
  );
}

function NotificationItem({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  const t = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        {!n.read_at ? <View style={[styles.dot, { backgroundColor: t.accent }]} /> : null}
        <View style={styles.flex}>
          <Heading>{n.title}</Heading>
          {n.body ? <Body muted>{n.body}</Body> : null}
          <Text style={[styles.date, { color: t.textSecondary }]}>{dateFmt.format(new Date(n.created_at))}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 7 },
  date: { fontSize: 12, marginTop: 2 },
});
