import { NotificationBell } from '@/components/notification-bell';
import { NavRow, Screen, Upcoming } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function InicioScreen() {
  const { profile } = useAuth();
  const firstName = profile?.full_name.split(' ')[0];

  return (
    <Screen title={firstName ? `Hola, ${firstName}` : 'Inicio'} subtitle="Novedades y eventos del CETU"
      action={<NotificationBell />}>
      <NavRow href="/propuestas" title="Propuestas" detail="Las ideas más votadas llegan a la comisión" />
      <NavRow href="/asistente" title="Asistente de trámites" detail="Te guía en trámites y redacta por vos" />
      <NavRow href="/elecciones" title="Elecciones" detail="Listas, candidatos y dónde votás" />
      <Upcoming
        items={[
          'Noticias fijadas arriba y feed por categoría (RF-6.1 – 6.3)',
          'Próximos eventos con "Me interesa / Voy" y agregar al calendario (RF-6.7 – 6.10)',
        ]}
      />
    </Screen>
  );
}
