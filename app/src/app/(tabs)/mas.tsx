import { Body, Button, Card, Heading, NavRow, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { MEMBER_TYPE_LABEL } from '@/lib/types';

const ROLE_NAMES = {
  superadmin: 'Superadmin',
  admin: 'Admin del CETU',
  comision: 'Comisión directiva',
  fotocopiadora: 'Fotocopiadora',
  comunicacion: 'Comunicación',
} as const;

export default function MasScreen() {
  const { profile, roles, isAdmin, hasRole, isVerified, signOut } = useAuth();
  const hasPanels = isAdmin || roles.length > 0;

  return (
    <Screen title="Más">
      <NavRow href="/notificaciones" title="Notificaciones" />
      <NavRow href="/propuestas" title="Propuestas" detail="Proponé y votá ideas" />
      <NavRow href="/asistente" title="Asistente de trámites" detail="Pasos, documentación y notas" />
      <NavRow href="/elecciones" title="Elecciones" detail="Listas, candidatos y padrón" />

      {hasPanels ? <Heading>Paneles</Heading> : null}
      {isAdmin ? <NavRow href="/admin" title="Panel del CETU" detail="Verificaciones, reportes, reclamos, trámites, precios" /> : null}
      {hasRole('comunicacion') ? <NavRow href="/comunicacion" title="Comunicación" detail="Noticias, eventos y elecciones" /> : null}
      {hasRole('fotocopiadora') || isAdmin ? <NavRow href="/fotocopiadora" title="Fotocopiadora" detail="Cola de pedidos" /> : null}
      {hasRole('comision') || isAdmin ? <NavRow href="/comision" title="Comisión directiva" detail="Propuestas elevadas" /> : null}

      <Heading>Mi cuenta</Heading>
      <Card>
        <Heading>{profile?.full_name || 'Sin nombre'}</Heading>
        <Body muted>
          {profile ? MEMBER_TYPE_LABEL[profile.member_type] : ''}
          {profile?.verification_status === 'verificado' ? ' · verificada' : ' · sin verificar'}
          {roles.length ? ` · ${roles.map((r) => ROLE_NAMES[r]).join(', ')}` : ''}
        </Body>
      </Card>
      {!isVerified ? <NavRow href="/verificacion" title="Estado de mi cuenta" /> : null}
      <Button title="Cerrar sesión" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
