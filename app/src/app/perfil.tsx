import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chips } from '@/components/chips';
import { Banner, Body, Button, Card, Field, Heading, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import { MEMBER_TYPE_LABEL, type Career, type Profile } from '@/lib/types';

const YEARS = [1, 2, 3, 4, 5, 6].map((y) => ({ value: String(y), label: `${y}°` }));

type MyCareer = { career_id: number; year: number | null };

export default function PerfilScreen() {
  const { session, profile } = useAuth();
  const userId = session?.user.id;

  const data = useQuery({
    queryKey: ['perfil', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [c, mine] = await Promise.all([
        supabase.from('careers').select('*').order('name'),
        supabase.from('profile_careers').select('career_id, year').eq('user_id', userId!),
      ]);
      if (c.error ?? mine.error) throw c.error ?? mine.error;
      return { careers: c.data as Career[], mine: mine.data as MyCareer[] };
    },
  });

  return (
    <Screen title="Mi perfil" hideVerificationBanner>
      {data.error ? <Banner tone="danger">{errorMessage(data.error)}</Banner> : null}
      {data.data && profile && userId ? (
        <PerfilForm userId={userId} profile={profile} careers={data.data.careers} mine={data.data.mine} />
      ) : null}
    </Screen>
  );
}

function PerfilForm({ userId, profile, careers, mine }: { userId: string; profile: Profile; careers: Career[]; mine: MyCareer[] }) {
  const t = useTheme();
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const [name, setName] = useState(profile.full_name);
  /** career_id → año (string) */
  const [picked, setPicked] = useState<Record<number, string>>(() =>
    Object.fromEntries(mine.map((m) => [m.career_id, String(m.year ?? 1)])),
  );
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (name.trim() !== profile.full_name) {
        const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', userId);
        if (error) throw error;
      }
      const del = await supabase.from('profile_careers').delete().eq('user_id', userId);
      if (del.error) throw del.error;
      const rows = Object.entries(picked).map(([career_id, year]) => ({ user_id: userId, career_id: Number(career_id), year: Number(year) }));
      if (rows.length) {
        const ins = await supabase.from('profile_careers').insert(rows);
        if (ins.error) throw ins.error;
      }
    },
    onMutate: () => setMessage(null),
    onSuccess: async () => {
      setMessage({ tone: 'info', text: 'Perfil guardado.' });
      await refresh();
      qc.invalidateQueries({ queryKey: ['perfil'] });
    },
    onError: (e) => setMessage({ tone: 'danger', text: errorMessage(e) }),
  });

  function toggleCareer(id: number) {
    setPicked((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = '1';
      return next;
    });
  }

  return (
    <>
      <Card>
        <Field label="Nombre y apellido" value={name} onChangeText={setName} />
        <Body muted>
          {MEMBER_TYPE_LABEL[profile.member_type]} · {profile.email}
        </Body>
        <Body muted>
          DNI {profile.dni ?? '—'} · Legajo {profile.legajo ?? '—'} (para cambiarlos, hablá con el CETU)
        </Body>
      </Card>

      <Heading>Mis carreras</Heading>
      <Body muted>Sirve para mostrarte primero tus materias y para avisos por carrera y año.</Body>
      {careers.map((c) => {
        const on = Boolean(picked[c.id]);
        return (
          <Card key={c.id}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggleCareer(c.id)}
              style={styles.row}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? t.accent : t.textSecondary} />
              <Text style={[styles.name, { color: t.text }]}>{c.name}</Text>
            </Pressable>
            {on ? (
              <View>
                <Body muted>¿En qué año estás?</Body>
                <Chips options={YEARS} value={picked[c.id]} onChange={(y) => setPicked((prev) => ({ ...prev, [c.id]: y }))} />
              </View>
            ) : null}
          </Card>
        );
      })}

      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      <Button title="Guardar" onPress={() => save.mutate()} loading={save.isPending} disabled={!name.trim()} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 16, flex: 1 },
});
