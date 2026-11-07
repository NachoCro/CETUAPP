import { Screen, Upcoming } from '@/components/ui';

export default function CopiasScreen() {
  return (
    <Screen title="Copias" subtitle="Pedí tu impresión y retirala lista">
      <Upcoming
        items={[
          'Subir PDF o elegir un apunte de la biblioteca (RF-2.1)',
          'Copias, doble faz, color y anillado, con precio estimado (RF-2.2, 2.4)',
          'Punto y horario de retiro (RF-2.3)',
          'Pago online con Mercado Pago o al retirar (RF-2.5)',
          'Estado del pedido: recibido → imprimiendo → listo (RF-2.7, 2.8)',
        ]}
      />
    </Screen>
  );
}
