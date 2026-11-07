import { Screen, Upcoming } from '@/components/ui';

export default function ReclamosScreen() {
  return (
    <Screen title="Reclamos" subtitle="Seguí cada reclamo hasta que se resuelva">
      <Upcoming
        items={[
          'Nuevo reclamo con categoría, fotos y opción anónima (RF-3.1, 3.2, 3.10)',
          'Mis reclamos con número de seguimiento y estado (RF-3.3, 3.4)',
          'Conversación con el CETU (RF-3.5)',
        ]}
      />
    </Screen>
  );
}
