import { Screen, Upcoming } from '@/components/ui';

export default function ComisionScreen() {
  return (
    <Screen title="Comisión directiva" subtitle="Propuestas elevadas" hideVerificationBanner>
      <Upcoming
        items={[
          'Propuestas que superaron el umbral de votos (RF-4.5)',
          'Responder y cambiar estado: aprobada, rechazada, en ejecución (RF-4.9, 4.10)',
        ]}
      />
    </Screen>
  );
}
