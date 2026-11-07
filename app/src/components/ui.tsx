import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

/** Contenedor estándar de pantalla: título, subtítulo y contenido con scroll. */
export function Screen({
  title,
  subtitle,
  children,
  hideVerificationBanner,
  action,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  hideVerificationBanner?: boolean;
  /** Botón a la derecha del título (ej. campanita de notificaciones). */
  action?: ReactNode;
}) {
  const t = useTheme();
  const { session, isVerified, loading, profile } = useAuth();
  const showBanner = !hideVerificationBanner && !loading && session && !isVerified;
  const isStaff = profile?.member_type === 'docente' || profile?.member_type === 'no_docente';

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: t.text }]}>{title}</Text>
            {action}
          </View>
          {subtitle ? <Text style={[styles.subtitle, { color: t.textSecondary }]}>{subtitle}</Text> : null}
          {showBanner && isStaff ? (
            <Banner>Tu cuenta es de personal de la facultad: podés ver el contenido, pero las funciones de estudiante no están disponibles.</Banner>
          ) : showBanner ? (
            <Banner tone="highlight">
              Tu cuenta todavía no está verificada: podés mirar, pero no subir, votar, reclamar ni pedir copias.{' '}
              <Link href="/verificacion" style={styles.bold}>
                Ver estado
              </Link>
            </Banner>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const t = useTheme();
  const style = [styles.card, { backgroundColor: t.backgroundElement, borderColor: t.line }];
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const t = useTheme();
  return <Text style={[styles.body, { color: muted ? t.textSecondary : t.text }]}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.heading, { color: t.text }]}>{children}</Text>;
}

export function Banner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'highlight' | 'danger' }) {
  const t = useTheme();
  const bg = tone === 'highlight' ? t.highlight : tone === 'danger' ? t.danger : t.backgroundSelected;
  const fg = tone === 'highlight' ? t.highlightText : tone === 'danger' ? '#ffffff' : t.text;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={[styles.body, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: t.accent }
          : { backgroundColor: 'transparent', borderColor: t.line, borderWidth: 1 },
        (pressed || inactive) && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? t.accentText : t.accent} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? t.accentText : t.accent }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.textSecondary}
        {...props}
        style={[styles.input, { color: t.text, backgroundColor: t.backgroundElement, borderColor: t.line }]}
      />
    </View>
  );
}

export function NavRow({ href, title, detail }: { href: Href; title: string; detail?: string }) {
  const t = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => [styles.card, { backgroundColor: t.backgroundElement, borderColor: t.line }, pressed && styles.pressed]}>
        <Text style={[styles.heading, { color: t.text }]}>{title}</Text>
        {detail ? <Text style={[styles.meta, { color: t.textSecondary }]}>{detail}</Text> : null}
      </Pressable>
    </Link>
  );
}

/** Lista de lo que va a tener una pantalla que todavía no está implementada. */
export function Upcoming({ items }: { items: string[] }) {
  const t = useTheme();
  return (
    <Card>
      <Text style={[styles.tag, { backgroundColor: t.highlight, color: t.highlightText }]}>En construcción</Text>
      {items.map((item) => (
        <Text key={item} style={[styles.body, { color: t.text }]}>
          • {item}
        </Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  title: { flexShrink: 1, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: -Spacing.one, marginBottom: Spacing.two },
  heading: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 13, marginTop: Spacing.half },
  bold: { fontWeight: '700', textDecorationLine: 'underline' },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: Spacing.one,
  },
  banner: { borderRadius: Radius.input, padding: Spacing.three },
  button: {
    borderRadius: Radius.input,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  field: { gap: 5, marginTop: Spacing.two },
  label: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: Radius.input, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16 },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 1,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
    marginBottom: Spacing.one,
  },
});
