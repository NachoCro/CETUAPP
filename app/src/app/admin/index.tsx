import { useQuery } from '@tanstack/react-query';

import { Heading, NavRow, Screen, Upcoming } from '@/components/ui';
import { supabase } from '@/lib/supabase';

async function count(table: 'profiles' | 'verification_requests', status: string) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(table === 'profiles' ? 'verification_status' : 'status', status);
  if (error) throw error;
  return count ?? 0;
}

export default function AdminScreen() {
  const counts = useQuery({
    queryKey: ['admin', 'counts'],
    queryFn: async () => ({
      pendingUsers: await count('profiles', 'pendiente'),
      pendingCerts: await count('verification_requests', 'pendiente'),
    }),
  });

  const pendingUsers = counts.data?.pendingUsers;
  const pendingCerts = counts.data?.pendingCerts;

  return (
    <Screen title="Panel del CETU" hideVerificationBanner>
      <Heading>Cuentas</Heading>
      <NavRow
        href="/admin/usuarios"
        title="Usuarios"
        detail={pendingUsers ? `${pendingUsers} pendientes de verificar` : 'Clasificar, verificar y asignar roles'}
      />
      <NavRow
        href="/admin/verificaciones"
        title="Certificados de alumno regular"
        detail={pendingCerts ? `${pendingCerts} para revisar` : 'No hay certificados pendientes'}
      />

      <Heading>Configuración</Heading>
      <NavRow href="/admin/catalogo" title="Catálogo académico" detail="Carreras, materias y profesores" />
      <NavRow href="/admin/configuracion" title="Ajustes de la app" detail="Umbral de votos, vigencia, dominio, asistente" />

      <Upcoming
        items={[
          'Bandeja de reportes de apuntes (Fase 2)',
          'Bandeja de reclamos (Fase 3)',
          'Precios y horarios de la fotocopiadora (Fase 6)',
          'Base de trámites del asistente (Fase 7)',
          'Importar padrón (Fase 8)',
        ]}
      />
    </Screen>
  );
}
