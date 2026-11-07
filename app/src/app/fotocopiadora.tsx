import { Screen, Upcoming } from '@/components/ui';

export default function FotocopiadoraScreen() {
  return (
    <Screen title="Fotocopiadora" subtitle="Cola de pedidos" hideVerificationBanner>
      <Upcoming
        items={[
          'Cola ordenada por horario de retiro, en tiempo real (RF-2.6)',
          'Configuración del pedido bien visible: copias, faz, color, anillado (RF-2.12)',
          'Botones "Imprimir" y "Hoja de retiro" (RF-2.12)',
          'Cambiar estado: imprimiendo → listo → retirado (RF-2.7)',
          'Registrar cobro al retirar (RF-2.9)',
        ]}
      />
    </Screen>
  );
}
