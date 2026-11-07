import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConfirmButton } from '@/components/confirm-button';
import { StatusBadge } from '@/components/status-badge';
import { Banner, Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/query';
import { openPrivateFile } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import {
  MEMBER_TYPE_LABEL,
  ROLE_LABEL,
  VERIFICATION_STATUS_LABEL,
  type AppRole,
  type MemberType,
  type Profile,
  type VerificationRequest,
  type VerificationStatus,
} from '@/lib/types';

const ROLES: AppRole[] = ['admin', 'comunicacion', 'comision', 'fotocopiadora', 'superadmin'];
const dateFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

export default function UsuarioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, hasRole } = useAuth();
  const isSuperadmin = hasRole('superadmin');
  const qc = useQueryClient();
  const t = useTheme();
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  const user = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: async () => {
      const [p, careers, reqs, roles] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('profile_careers').select('year, careers(name)').eq('user_id', id),
        supabase.from('verification_requests').select('*').eq('user_id', id).order('created_at', { ascending: false }),
        supabase.from('user_roles').select('role').eq('user_id', id),
      ]);
      if (p.error) throw p.error;
      return {
        profile: p.data as Profile & { created_at: string },
        careers: (careers.data ?? []) as unknown as { year: number | null; careers: { name: string } | null }[],
        requests: (reqs.data ?? []) as VerificationRequest[],
        roles: ((roles.data ?? []) as { role: AppRole }[]).map((r) => r.role),
      };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const onError = (e: unknown) => setMessage({ tone: 'danger', text: errorMessage(e) });

  const classify = useMutation({
    mutationFn: async (args: { type: MemberType | null; status: VerificationStatus }) => {
      const { error } = await supabase.rpc('classify_users', {
        p_user_ids: [id],
        p_member_type: args.type,
        p_status: args.status,
      });
      if (error) throw error;
    },
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setMessage({ tone: 'info', text: 'Usuario actualizado.' });
      refresh();
    },
    onError,
  });

  const toggleRole = useMutation({
    mutationFn: async ({ role, enable }: { role: AppRole; enable: boolean }) => {
      const { error } = enable
        ? await supabase.from('user_roles').insert({ user_id: id, role })
        : await supabase.from('user_roles').delete().eq('user_id', id).eq('role', role);
      if (error) throw error;
    },
    onMutate: () => setMessage(null),
    onSuccess: refresh,
    onError,
  });

  if (!user.data) {
    return (
      <Screen title="Usuario" hideVerificationBanner>
        {user.error ? <Banner tone="danger">{errorMessage(user.error)}</Banner> : <Body muted>Cargando…</Body>}
      </Screen>
    );
  }

  const { profile: p, careers, requests, roles } = user.data;
  const isMe = session?.user.id === p.id;

  return (
    <Screen title={p.full_name || 'Sin nombre'} hideVerificationBanner>
      <View style={styles.badges}>
        <StatusBadge
          label={VERIFICATION_STATUS_LABEL[p.verification_status]}
          tone={p.verification_status === 'verificado' ? 'ok' : p.verification_status === 'pendiente' ? 'highlight' : 'neutral'}
        />
        <StatusBadge label={MEMBER_TYPE_LABEL[p.member_type]} />
        {p.institutional_email ? <StatusBadge label="Mail institucional" tone="ok" /> : null}
      </View>

      <Card>
        <Body>{p.email}</Body>
        <Body muted>
          DNI {p.dni ?? '—'} · Legajo {p.legajo ?? '—'}
        </Body>
        <Body muted>Registrado el {dateFmt.format(new Date(p.created_at))}</Body>
        {careers.length ? (
          <Body muted>
            {careers.map((c) => `${c.careers?.name ?? '?'}${c.year ? ` (${c.year}° año)` : ''}`).join(' · ')}
          </Body>
        ) : null}
      </Card>

      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}

      <Heading>Clasificar</Heading>
      <Card>
        <Button title="Verificar como alumno/a" onPress={() => classify.mutate({ type: 'alumno', status: 'verificado' })} disabled={classify.isPending} />
        <Button title="Verificar como docente" variant="ghost" onPress={() => classify.mutate({ type: 'docente', status: 'verificado' })} disabled={classify.isPending} />
        <Button title="Verificar como no docente" variant="ghost" onPress={() => classify.mutate({ type: 'no_docente', status: 'verificado' })} disabled={classify.isPending} />
        <ConfirmButton title="Rechazar" question="¿Rechazar la verificación?" onConfirm={() => classify.mutate({ type: null, status: 'rechazado' })} disabled={classify.isPending} />
        {p.verification_status === 'suspendido' ? (
          <Button title="Reactivar (volver a pendiente)" variant="ghost" onPress={() => classify.mutate({ type: null, status: 'pendiente' })} disabled={classify.isPending} />
        ) : (
          <ConfirmButton title="Suspender" question="¿Suspender esta cuenta?" onConfirm={() => classify.mutate({ type: null, status: 'suspendido' })} disabled={classify.isPending || isMe} />
        )}
      </Card>

      {requests.length ? <Heading>Certificados enviados</Heading> : null}
      {requests.map((r) => (
        <Card key={r.id}>
          <StatusBadge label={VERIFICATION_STATUS_LABEL[r.status]} tone={r.status === 'verificado' ? 'ok' : r.status === 'pendiente' ? 'highlight' : 'neutral'} />
          <Body muted>Enviado el {dateFmt.format(new Date(r.created_at))}</Body>
          {r.rejection_reason ? <Body>Motivo: {r.rejection_reason}</Body> : null}
          <Button title="Ver documento" variant="ghost" onPress={() => openPrivateFile('verificaciones', r.document_path).catch(onError)} />
        </Card>
      ))}

      <Heading>Roles</Heading>
      {isSuperadmin ? (
        <Card>
          {ROLES.map((role) => {
            const on = roles.includes(role);
            const locked = isMe && role === 'superadmin'; // no quitarse el propio superadmin
            return (
              <Pressable
                key={role}
                accessibilityRole="switch"
                accessibilityState={{ checked: on, disabled: locked }}
                disabled={locked || toggleRole.isPending}
                onPress={() => toggleRole.mutate({ role, enable: !on })}
                style={styles.roleRow}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? t.accent : t.textSecondary} />
                <Text style={[styles.roleText, { color: locked ? t.textSecondary : t.text }]}>{ROLE_LABEL[role]}</Text>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <Body muted>Solo el superadmin puede asignar o quitar roles.</Body>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  roleText: { fontSize: 16 },
});
