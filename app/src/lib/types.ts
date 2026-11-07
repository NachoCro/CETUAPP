// Tipos que reflejan supabase/migrations/0001_schema.sql.
// Cuando exista el proyecto, se pueden generar completos con:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type AppRole = 'superadmin' | 'admin' | 'comision' | 'fotocopiadora' | 'comunicacion';

export type VerificationStatus = 'pendiente' | 'verificado' | 'rechazado' | 'suspendido';

export type AppNotification = {
  id: string;
  user_id: string;
  type: string; // verificacion, pedido_listo, reclamo_estado, reclamo_respuesta, propuesta_elevada, ...
  title: string;
  body: string | null;
  data: { claim_id?: string; order_id?: string; proposal_id?: string; post_id?: string };
  read_at: string | null;
  created_at: string;
};

export type MemberType = 'alumno' | 'docente' | 'no_docente';

export const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  alumno: 'Alumno/a',
  docente: 'Docente',
  no_docente: 'No docente',
};

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  dni: string | null;
  legajo: string | null;
  member_type: MemberType;
  institutional_email: boolean;
  verification_status: VerificationStatus;
  verification_method: 'revision_admin' | 'documento' | null;
  verified_at: string | null;
};
