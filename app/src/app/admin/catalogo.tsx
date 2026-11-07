import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chips } from '@/components/chips';
import { ConfirmButton } from '@/components/confirm-button';
import { ListState } from '@/components/list-state';
import { Banner, Body, Button, Card, Field, Heading, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import type { Career, Professor, Subject } from '@/lib/types';

type Tab = 'carreras' | 'materias' | 'profesores';
const TABS: { value: Tab; label: string }[] = [
  { value: 'carreras', label: 'Carreras' },
  { value: 'materias', label: 'Materias' },
  { value: 'profesores', label: 'Profesores' },
];
const YEARS = [1, 2, 3, 4, 5, 6].map((y) => ({ value: String(y), label: `${y}° año` }));

function friendlyError(e: unknown) {
  const msg = errorMessage(e);
  if (/foreign key|violates/i.test(msg)) return 'No se puede borrar: hay apuntes u otros datos que lo usan.';
  if (/duplicate|unique/i.test(msg)) return 'Ya existe uno con ese nombre.';
  return msg;
}

function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: async () => {
      const [c, s, p, sp] = await Promise.all([
        supabase.from('careers').select('*').order('name'),
        supabase.from('subjects').select('*').order('year').order('name'),
        supabase.from('professors').select('*').order('full_name'),
        supabase.from('subject_professors').select('*'),
      ]);
      const err = c.error ?? s.error ?? p.error ?? sp.error;
      if (err) throw err;
      return {
        careers: c.data as Career[],
        subjects: s.data as Subject[],
        professors: p.data as Professor[],
        links: sp.data as { subject_id: number; professor_id: number }[],
      };
    },
  });
}

/** Ejecuta una operación sobre el catálogo y refresca. */
function useCatalogMutation<T>(fn: (arg: T) => PromiseLike<{ error: unknown }>, onError: (msg: string) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arg: T) => {
      const { error } = await fn(arg);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog'] }),
    onError: (e) => onError(friendlyError(e)),
  });
}

export default function CatalogoScreen() {
  const [tab, setTab] = useState<Tab>('carreras');
  const [error, setError] = useState<string | null>(null);
  const catalog = useCatalog();

  return (
    <Screen title="Catálogo académico" hideVerificationBanner>
      <Chips options={TABS} value={tab} onChange={(v) => { setTab(v); setError(null); }} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <ListState query={{ ...catalog, data: catalog.data ? [catalog.data] : undefined }} empty="">
        {catalog.data && tab === 'carreras' ? <CareersTab data={catalog.data} onError={setError} /> : null}
        {catalog.data && tab === 'materias' ? <SubjectsTab data={catalog.data} onError={setError} /> : null}
        {catalog.data && tab === 'profesores' ? <ProfessorsTab data={catalog.data} onError={setError} /> : null}
      </ListState>
    </Screen>
  );
}

type TabProps = { data: NonNullable<ReturnType<typeof useCatalog>['data']>; onError: (msg: string) => void };

// --- Carreras -----------------------------------------------------------------
function CareersTab({ data, onError }: TabProps) {
  const add = useCatalogMutation((name: string) => supabase.from('careers').insert({ name }), onError);
  const rename = useCatalogMutation((a: { id: number; name: string }) => supabase.from('careers').update({ name: a.name }).eq('id', a.id), onError);
  const remove = useCatalogMutation((id: number) => supabase.from('careers').delete().eq('id', id), onError);

  return (
    <>
      <AddForm label="Nueva carrera" onAdd={(name) => add.mutate(name)} loading={add.isPending} />
      {data.careers.map((c) => (
        <CatalogItem
          key={c.id}
          name={c.name}
          detail={`${data.subjects.filter((s) => s.career_id === c.id).length} materias`}
          onRename={(name) => rename.mutate({ id: c.id, name })}
          onDelete={() => remove.mutate(c.id)}
          deleteQuestion="¿Borrar la carrera y todas sus materias?"
        />
      ))}
    </>
  );
}

// --- Materias -----------------------------------------------------------------
function SubjectsTab({ data, onError }: TabProps) {
  const [careerId, setCareerId] = useState(String(data.careers[0]?.id ?? ''));
  const [year, setYear] = useState('1');
  const [editingProfs, setEditingProfs] = useState<number | null>(null);

  const add = useCatalogMutation(
    (name: string) => supabase.from('subjects').insert({ name, career_id: Number(careerId), year: Number(year) }),
    onError,
  );
  const rename = useCatalogMutation((a: { id: number; name: string }) => supabase.from('subjects').update({ name: a.name }).eq('id', a.id), onError);
  const remove = useCatalogMutation((id: number) => supabase.from('subjects').delete().eq('id', id), onError);
  const link = useCatalogMutation(
    (a: { subject_id: number; professor_id: number; on: boolean }) =>
      a.on
        ? supabase.from('subject_professors').insert({ subject_id: a.subject_id, professor_id: a.professor_id })
        : supabase.from('subject_professors').delete().eq('subject_id', a.subject_id).eq('professor_id', a.professor_id),
    onError,
  );

  if (!data.careers.length) return <Body muted>Primero cargá al menos una carrera.</Body>;

  const subjects = data.subjects.filter((s) => s.career_id === Number(careerId));
  const profName = new Map(data.professors.map((p) => [p.id, p.full_name]));

  return (
    <>
      <Chips options={data.careers.map((c) => ({ value: String(c.id), label: c.name }))} value={careerId} onChange={setCareerId} />
      <Card>
        <Heading>Nueva materia</Heading>
        <Chips options={YEARS} value={year} onChange={setYear} />
        <AddForm label="Nombre" onAdd={(name) => add.mutate(name)} loading={add.isPending} bare />
      </Card>

      {YEARS.map(({ value, label }) => {
        const ofYear = subjects.filter((s) => s.year === Number(value));
        if (!ofYear.length) return null;
        return (
          <View key={value} style={styles.group}>
            <Heading>{label}</Heading>
            {ofYear.map((s) => {
              const linked = data.links.filter((l) => l.subject_id === s.id).map((l) => l.professor_id);
              return (
                <CatalogItem
                  key={s.id}
                  name={s.name}
                  detail={linked.length ? linked.map((id) => profName.get(id)).join(', ') : 'Sin profesores asignados'}
                  onRename={(name) => rename.mutate({ id: s.id, name })}
                  onDelete={() => remove.mutate(s.id)}
                  deleteQuestion="¿Borrar la materia?"
                  extra={
                    editingProfs === s.id ? (
                      <>
                        <Body muted>Tocá un profesor para asignarlo o quitarlo:</Body>
                        {data.professors.map((p) => {
                          const on = linked.includes(p.id);
                          return (
                            <Button
                              key={p.id}
                              title={`${on ? '✓ ' : ''}${p.full_name}`}
                              variant={on ? 'primary' : 'ghost'}
                              onPress={() => link.mutate({ subject_id: s.id, professor_id: p.id, on: !on })}
                              disabled={link.isPending}
                            />
                          );
                        })}
                        <Button title="Listo" variant="ghost" onPress={() => setEditingProfs(null)} />
                      </>
                    ) : (
                      <Button title="Profesores" variant="ghost" onPress={() => setEditingProfs(s.id)} />
                    )
                  }
                />
              );
            })}
          </View>
        );
      })}
      {!subjects.length ? <Body muted>Esta carrera todavía no tiene materias.</Body> : null}
    </>
  );
}

// --- Profesores ---------------------------------------------------------------
function ProfessorsTab({ data, onError }: TabProps) {
  const add = useCatalogMutation((full_name: string) => supabase.from('professors').insert({ full_name }), onError);
  const rename = useCatalogMutation(
    (a: { id: number; name: string }) => supabase.from('professors').update({ full_name: a.name }).eq('id', a.id),
    onError,
  );
  const remove = useCatalogMutation((id: number) => supabase.from('professors').delete().eq('id', id), onError);

  return (
    <>
      <AddForm label="Nuevo profesor/a" onAdd={(name) => add.mutate(name)} loading={add.isPending} />
      {data.professors.map((p) => (
        <CatalogItem
          key={p.id}
          name={p.full_name}
          detail={`${data.links.filter((l) => l.professor_id === p.id).length} materias`}
          onRename={(name) => rename.mutate({ id: p.id, name })}
          onDelete={() => remove.mutate(p.id)}
          deleteQuestion="¿Borrar este profesor/a?"
        />
      ))}
    </>
  );
}

// --- Piezas comunes -----------------------------------------------------------
function AddForm({ label, onAdd, loading, bare }: { label: string; onAdd: (name: string) => void; loading?: boolean; bare?: boolean }) {
  const [name, setName] = useState('');
  const form = (
    <>
      <Field label={label} value={name} onChangeText={setName} onSubmitEditing={() => name.trim() && (onAdd(name.trim()), setName(''))} />
      <Button
        title="Agregar"
        onPress={() => {
          onAdd(name.trim());
          setName('');
        }}
        loading={loading}
        disabled={!name.trim()}
      />
    </>
  );
  return bare ? form : <Card>{form}</Card>;
}

function CatalogItem({
  name,
  detail,
  onRename,
  onDelete,
  deleteQuestion,
  extra,
}: {
  name: string;
  detail?: string;
  onRename: (name: string) => void;
  onDelete: () => void;
  deleteQuestion: string;
  extra?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  return (
    <Card>
      {editing ? (
        <>
          <Field label="Nombre" value={value} onChangeText={setValue} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title="Cancelar" variant="ghost" onPress={() => { setValue(name); setEditing(false); }} />
            </View>
            <View style={styles.flex}>
              <Button
                title="Guardar"
                disabled={!value.trim() || value.trim() === name}
                onPress={() => {
                  onRename(value.trim());
                  setEditing(false);
                }}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <Heading>{name}</Heading>
          {detail ? <Body muted>{detail}</Body> : null}
          {extra}
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title="Editar" variant="ghost" onPress={() => setEditing(true)} />
            </View>
            <View style={styles.flex}>
              <ConfirmButton title="Borrar" question={deleteQuestion} onConfirm={onDelete} />
            </View>
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  flex: { flex: 1 },
});
