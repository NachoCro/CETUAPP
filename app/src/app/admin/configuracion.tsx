import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Banner, Body, Button, Card, Field, Heading, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/query';
import { supabase } from '@/lib/supabase';

type SettingKey =
  | 'proposal_vote_threshold'
  | 'proposal_duration_days'
  | 'institutional_email_domain'
  | 'assistant_daily_message_limit';

const FIELDS: { key: SettingKey; label: string; help: string; numeric: boolean; min?: number }[] = [
  {
    key: 'proposal_vote_threshold',
    label: 'Votos para elevar una propuesta',
    help: 'Al llegar a esta cantidad, la propuesta pasa sola a la comisión directiva.',
    numeric: true,
    min: 1,
  },
  {
    key: 'proposal_duration_days',
    label: 'Vigencia de las propuestas (días)',
    help: 'Si no llega al umbral en este plazo, se archiva. Aplica a las propuestas nuevas.',
    numeric: true,
    min: 1,
  },
  {
    key: 'assistant_daily_message_limit',
    label: 'Mensajes diarios al asistente por alumno',
    help: 'Controla el costo de la IA.',
    numeric: true,
    min: 0,
  },
  {
    key: 'institutional_email_domain',
    label: 'Dominio del mail institucional',
    help: 'Las cuentas con este dominio aparecen marcadas en la lista de usuarios.',
    numeric: false,
  },
];

type Settings = Partial<Record<SettingKey, string>>;

export default function ConfiguracionScreen() {
  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value');
      if (error) throw error;
      return Object.fromEntries((data as { key: SettingKey; value: unknown }[]).map((r) => [r.key, String(r.value)]));
    },
  });

  return (
    <Screen title="Ajustes de la app" hideVerificationBanner>
      {settings.error ? <Banner tone="danger">{errorMessage(settings.error)}</Banner> : null}
      {settings.data ? <SettingsForm saved={settings.data} /> : null}
    </Screen>
  );
}

function SettingsForm({ saved }: { saved: Settings }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Settings>(saved);
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      for (const f of FIELDS) {
        const raw = (values[f.key] ?? '').trim();
        if (raw === saved[f.key]) continue;
        let value: number | string = raw;
        if (f.numeric) {
          value = Number(raw);
          if (!Number.isInteger(value) || value < (f.min ?? 0)) throw new Error(`"${f.label}" tiene que ser un número entero mayor o igual a ${f.min ?? 0}.`);
        } else if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw)) {
          throw new Error('El dominio no es válido (ej.: frsn.utn.edu.ar, sin @).');
        }
        const { error } = await supabase
          .from('app_settings')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', f.key);
        if (error) throw error;
      }
    },
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setMessage({ tone: 'info', text: 'Cambios guardados.' });
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (e) => setMessage({ tone: 'danger', text: errorMessage(e) }),
  });

  return (
    <>
      {FIELDS.map((f) => (
        <Card key={f.key}>
          <Heading>{f.label}</Heading>
          <Body muted>{f.help}</Body>
          <Field
            label=""
            value={values[f.key] ?? ''}
            onChangeText={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
            keyboardType={f.numeric ? 'number-pad' : 'default'}
            autoCapitalize="none"
          />
        </Card>
      ))}
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      <Button title="Guardar cambios" onPress={() => save.mutate()} loading={save.isPending} />
    </>
  );
}
