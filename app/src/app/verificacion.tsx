import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { StatusBadge } from '@/components/status-badge';
import { Banner, Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/query';
import { MB, pickDocument, uploadFile } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { MEMBER_TYPE_LABEL, VERIFICATION_STATUS_LABEL, type VerificationRequest } from '@/lib/types';

const STATUS_TEXT = {
  pendiente: 'Pendiente de verificación',
  verificado: 'Cuenta verificada',
  rechazado: 'Verificación rechazada',
  suspendido: 'Cuenta suspendida',
} as const;

const dateFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

export default function VerificacionScreen() {
  const { session, profile, refresh } = useAuth();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const status = profile?.verification_status ?? 'pendiente';
  const memberType = profile?.member_type ?? 'alumno';

  const requests = useQuery({
    queryKey: ['verification_requests', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verification_requests')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as VerificationRequest[];
    },
  });

  const hasPending = requests.data?.some((r) => r.status === 'pendiente') ?? false;
  const canRequest = status === 'pendiente' || status === 'rechazado';

  const upload = useMutation({
    mutationFn: async () => {
      const file = await pickDocument({ types: ['application/pdf', 'image/*'], maxBytes: 10 * MB });
      if (!file) return false;
      const path = await uploadFile('verificaciones', userId!, file);
      const { error } = await supabase.from('verification_requests').insert({ user_id: userId, document_path: path });
      if (error) throw error;
      return true;
    },
    onMutate: () => setError(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verification_requests'] }),
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Screen title="Verificar cuenta" hideVerificationBanner>
      <Banner tone={status === 'verificado' ? 'info' : status === 'pendiente' ? 'highlight' : 'danger'}>
        {STATUS_TEXT[status]} · {MEMBER_TYPE_LABEL[memberType]}
      </Banner>

      {memberType !== 'alumno' && status === 'verificado' ? (
        <Body muted>
          Tu cuenta figura como {MEMBER_TYPE_LABEL[memberType].toLowerCase()}. Si sos estudiante, subí tu certificado
          de alumno regular y el CETU la corrige.
        </Body>
      ) : null}

      {status === 'suspendido' ? <Body muted>Si creés que es un error, comunicate con el CETU.</Body> : null}

      {canRequest || (memberType !== 'alumno' && status === 'verificado') ? (
        <>
          <Card>
            <Heading>El CETU revisa tu cuenta</Heading>
            <Body muted>
              {profile?.institutional_email
                ? 'Confirmaste tu mail @frsn.utn.edu.ar: el CETU te va a verificar a la brevedad.'
                : 'Como no usaste un mail @frsn.utn.edu.ar, la forma más rápida es subir tu certificado.'}
            </Body>
          </Card>
          <Card>
            <Heading>Subir certificado de alumno regular</Heading>
            <Body muted>PDF o foto, hasta 10 MB. Lo ve solo el CETU.</Body>
            {hasPending ? (
              <Body>Ya enviaste un certificado: está en revisión.</Body>
            ) : (
              <Button title="Elegir archivo" onPress={() => upload.mutate()} loading={upload.isPending} />
            )}
            {error ? <Banner tone="danger">{error}</Banner> : null}
          </Card>
        </>
      ) : null}

      {requests.data?.length ? <Heading>Mis solicitudes</Heading> : null}
      {requests.data?.map((r) => (
        <Card key={r.id}>
          <StatusBadge
            label={VERIFICATION_STATUS_LABEL[r.status]}
            tone={r.status === 'verificado' ? 'ok' : r.status === 'pendiente' ? 'highlight' : 'neutral'}
          />
          <Body muted>Enviada el {dateFmt.format(new Date(r.created_at))}</Body>
          {r.rejection_reason ? <Body>Motivo: {r.rejection_reason}</Body> : null}
        </Card>
      ))}

      <Button
        title="Actualizar estado"
        variant="ghost"
        onPress={() => {
          void refresh();
          void requests.refetch();
        }}
      />
    </Screen>
  );
}
