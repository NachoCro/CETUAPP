import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ListState } from '@/components/list-state';
import { StatusBadge } from '@/components/status-badge';
import { Banner, Body, Button, Card, Field, Heading, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/query';
import { openPrivateFile } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { MEMBER_TYPE_LABEL, type MemberType, type VerificationRequest } from '@/lib/types';

type PendingRequest = VerificationRequest & {
  profile: { full_name: string; email: string | null; dni: string | null; member_type: MemberType; institutional_email: boolean } | null;
};

const dateFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function VerificacionesScreen() {
  const requests = useQuery({
    queryKey: ['admin', 'verification_requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verification_requests')
        .select('*, profile:profiles!verification_requests_user_id_fkey(full_name, email, dni, member_type, institutional_email)')
        .eq('status', 'pendiente')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as PendingRequest[];
    },
  });

  return (
    <Screen title="Certificados" subtitle="Certificados de alumno regular para revisar, del más viejo al más nuevo" hideVerificationBanner>
      <ListState query={requests} empty="No hay certificados pendientes. 🎉">
        {requests.data?.map((r) => <RequestCard key={r.id} request={r} />)}
      </ListState>
    </Screen>
  );
}

function RequestCard({ request: r }: { request: PendingRequest }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const review = useMutation({
    mutationFn: async (approve: boolean) => {
      const { error } = await supabase.rpc('review_verification', {
        p_request_id: r.id,
        p_approve: approve,
        p_reason: approve ? null : reason.trim(),
      });
      if (error) throw error;
    },
    onMutate: () => setError(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Card>
      <Heading>{r.profile?.full_name || 'Sin nombre'}</Heading>
      <Body muted>
        {r.profile?.email} · DNI {r.profile?.dni ?? '—'}
      </Body>
      <View style={styles.badges}>
        {r.profile ? <StatusBadge label={`Declara: ${MEMBER_TYPE_LABEL[r.profile.member_type]}`} /> : null}
        {r.profile?.institutional_email ? <StatusBadge label="Mail institucional" tone="ok" /> : null}
      </View>
      <Body muted>Enviado el {dateFmt.format(new Date(r.created_at))}</Body>

      <Button title="Ver certificado" variant="ghost" onPress={() => openPrivateFile('verificaciones', r.document_path).catch((e) => setError(errorMessage(e)))} />
      <Button title="Ver usuario" variant="ghost" onPress={() => router.push(`/admin/usuarios/${r.user_id}`)} />

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {rejecting ? (
        <>
          <Field label="Motivo del rechazo (lo ve el alumno)" value={reason} onChangeText={setReason} placeholder="Ej.: el certificado está vencido" />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title="Cancelar" variant="ghost" onPress={() => setRejecting(false)} />
            </View>
            <View style={styles.flex}>
              <Button title="Rechazar" onPress={() => review.mutate(false)} loading={review.isPending} disabled={!reason.trim()} />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="Rechazar" variant="ghost" onPress={() => setRejecting(true)} disabled={review.isPending} />
          </View>
          <View style={styles.flex}>
            <Button title="Aprobar como alumno/a" onPress={() => review.mutate(true)} loading={review.isPending} />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
