import { Screen, Upcoming } from '@/components/ui';

export default function ApuntesScreen() {
  return (
    <Screen title="Apuntes" subtitle="Todas las carreras, en un solo lugar">
      <Upcoming
        items={[
          'Biblioteca por carrera → año → materia (RF-1.1)',
          'Búsqueda por materia, profesor o texto (RF-1.3)',
          'Subir PDF (RF-1.2)',
          'Calificar 1–5 y reportar (RF-1.5, 1.6)',
        ]}
      />
    </Screen>
  );
}
