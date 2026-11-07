import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chips } from '@/components/chips';
import { ConfirmButton } from '@/components/confirm-button';
import { ListState } from '@/components/list-state';
import { StatusBadge } from '@/components/status-badge';
import { Banner, Body, Button, Card, Field, Heading, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import {
  MEMBER_TYPE_LABEL,
  VERIFICATION_STATUS_LABEL,
  type MemberType,
  type Profile,
  type VerificationStatus,
} from '@/lib/types';

type AdminUser = Profile & { created_at: string };

const PAGE = 50;

const STATUS_OPTIONS: { value: VerificationStatus | 'todos'; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'verificado', label: 'Verificados' },
  { value: 'rechazado', label: 'Rechazados' },
  { value: 'suspendido', label: 'Suspendidos' },
  { value: 'todos', label: 'Todos' },
];

const TYPE_OPTIONS: { value: MemberType | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Cualquier tipo' },
  { value: 'alumno', label: 'Alumnos' },
  { value: 'docente', label: 'Docentes' },
  { value: 'no_docente', label: 'No docentes' },
];

const MAIL_OPTIONS = [
  { value: 'todos', label: 'Cualquier mail' },
  { value: 'institucional', label: '@frsn.utn.edu.ar' },
  { value: 'otro', label: 'Otro mail' },
] as const;

/** Acciones en lote: tipo null = conservar el tipo de cada usuario. */
const BULK_ACTIONS: { key: string; title: string; type: MemberType | null; status: VerificationStatus }[] = [
  { key: 'alumno', title: 'Verificar como alumnos', type: 'alumno', status: 'verificado' },
  { key: 'docente', title: 'Marcar como docentes', type: 'docente', status: 'verificado' },
  { key: 'no_docente', title: 'Marcar como no docentes', type: 'no_docente', status: 'verificado' },
  { key: 'rechazar', title: 'Rechazar', type: null, status: 'rechazado' },
  { key: 'suspender', title: 'Suspender', type: null, status: 'suspendido' },
];

export default function UsuariosScreen() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<VerificationStatus | 'todos'>('pendiente');
  const [type, setType] = useState<MemberType | 'todos'>('todos');
  const [mail, setMail] = useState<'todos' | 'institucional' | 'otro'>('todos');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  const term = search.trim().replace(/[,()*%]/g, ' ').trim();

  const users = useQuery({
    queryKey: ['admin', 'users', { status, type, mail, term, limit }],
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (status !== 'todos') q = q.eq('verification_status', status);
      if (type !== 'todos') q = q.eq('member_type', type);
      if (mail !== 'todos') q = q.eq('institutional_email', mail === 'institucional');
      if (term) q = q.or(`full_name.ilike.*${term}*,email.ilike.*${term}*,dni.ilike.*${term}*,legajo.ilike.*${term}*`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data as AdminUser[], total: count ?? 0 };
    },
  });

  const rows = users.data?.rows ?? [];
  const total = users.data?.total ?? 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function changeFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setSelected(new Set());
      setLimit(PAGE);
    };
  }

  const classify = useMutation({
    mutationFn: async (action: (typeof BULK_ACTIONS)[number]) => {
      const { data, error } = await supabase.rpc('classify_users', {
        p_user_ids: [...selected],
        p_member_type: action.type,
        p_status: action.status,
      });
      if (error) throw error;
      return data as number;
    },
    onMutate: () => setMessage(null),
    onSuccess: (n) => {
      setMessage({ tone: 'info', text: n === 1 ? '1 usuario actualizado.' : `${n} usuarios actualizados.` });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => setMessage({ tone: 'danger', text: errorMessage(e) }),
  });

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <Screen title="Usuarios" hideVerificationBanner>
      <Field
        label="Buscar"
        placeholder="Nombre, mail, DNI o legajo"
        value={search}
        onChangeText={changeFilter(setSearch)}
        autoCapitalize="none"
      />
      <Chips options={STATUS_OPTIONS} value={status} onChange={changeFilter(setStatus)} />
      <Chips options={TYPE_OPTIONS} value={type} onChange={changeFilter(setType)} />
      <Chips options={[...MAIL_OPTIONS]} value={mail} onChange={changeFilter(setMail)} />

      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}

      {selected.size > 0 ? (
        <Card>
          <Heading>
            {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
          </Heading>
          {BULK_ACTIONS.map((a) => (
            <ConfirmButton
              key={a.key}
              title={a.title}
              question={`¿${a.title} (${selected.size})?`}
              onConfirm={() => classify.mutate(a)}
              loading={classify.isPending && classify.variables?.key === a.key}
              disabled={classify.isPending}
            />
          ))}
          <Button title="Quitar selección" variant="ghost" onPress={() => setSelected(new Set())} />
        </Card>
      ) : null}

      {rows.length > 0 ? (
        <View style={styles.listHeader}>
          <Body muted>
            {total} usuario{total === 1 ? '' : 's'}
          </Body>
          <Pressable
            onPress={() => setSelected(allVisibleSelected ? new Set() : new Set(rows.map((r) => r.id)))}
            hitSlop={8}>
            <Body>{allVisibleSelected ? 'Quitar todos' : 'Seleccionar los visibles'}</Body>
          </Pressable>
        </View>
      ) : null}

      <ListState query={{ ...users, data: rows }} empty="No hay usuarios con estos filtros.">
        {rows.map((u) => (
          <UserRow key={u.id} user={u} selected={selected.has(u.id)} onToggle={() => toggle(u.id)} />
        ))}
        {rows.length < total ? (
          <Button title="Cargar más" variant="ghost" onPress={() => setLimit((l) => l + PAGE)} loading={users.isFetching} />
        ) : null}
      </ListState>
    </Screen>
  );
}

function UserRow({ user, selected, onToggle }: { user: AdminUser; selected: boolean; onToggle: () => void }) {
  const t = useTheme();
  return (
    <Card onPress={() => router.push(`/admin/usuarios/${user.id}`)}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`Seleccionar a ${user.full_name}`}
          onPress={onToggle}
          hitSlop={10}>
          <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={24} color={selected ? t.accent : t.textSecondary} />
        </Pressable>
        <View style={styles.flex}>
          <Heading>{user.full_name || 'Sin nombre'}</Heading>
          <Text style={[styles.meta, { color: t.textSecondary }]}>
            {user.email}
            {user.dni ? ` · DNI ${user.dni}` : ''}
          </Text>
          <View style={styles.badges}>
            <StatusBadge
              label={VERIFICATION_STATUS_LABEL[user.verification_status]}
              tone={user.verification_status === 'verificado' ? 'ok' : user.verification_status === 'pendiente' ? 'highlight' : 'neutral'}
            />
            <StatusBadge label={MEMBER_TYPE_LABEL[user.member_type]} />
            {user.institutional_email ? <StatusBadge label="Mail institucional" tone="ok" /> : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  meta: { fontSize: 13 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, borderRadius: Radius.input },
});
