import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useNotifications } from '@/hooks/use-notifications';

export function NotificationBell() {
  const t = useTheme();
  const { unread } = useNotifications();
  const label = unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones';

  return (
    <Link href="/notificaciones" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} style={styles.button}>
        <Ionicons name="notifications-outline" size={26} color={t.text} />
        {unread > 0 ? (
          <View style={[styles.badge, { backgroundColor: t.accent }]}>
            <Text style={[styles.count, { color: t.accentText }]}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontSize: 11, fontWeight: '700' },
});
