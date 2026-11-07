import { Screen, Upcoming } from '@/components/ui';

export default function AdminScreen() {
  return (
    <Screen title="Panel del CETU" hideVerificationBanner>
      <Upcoming
        items={[
          'Cola de verificaciones de cuentas (RF-0.4 – 0.6)',
          'Bandeja de reportes de apuntes (RF-1.7 – 1.9)',
          'Bandeja de reclamos con filtros y bitácora de gestión (RF-3.6, 3.8)',
          'Base de trámites del asistente (RF-5.5)',
          'Catálogo: carreras, materias y profesores (RF-0.9)',
          'Precios, puntos de retiro y horarios de la fotocopiadora (RF-2.10)',
          'Importar padrón electoral (RF-6.14)',
          'Configuración: umbral de votos, vigencia de propuestas, dominio institucional',
        ]}
      />
    </Screen>
  );
}
