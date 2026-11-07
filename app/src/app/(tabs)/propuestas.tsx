import { Screen, Upcoming } from '@/components/ui';

export default function PropuestasScreen() {
  return (
    <Screen title="Propuestas" subtitle="Las ideas más votadas llegan a la comisión">
      <Upcoming
        items={[
          'Sección destacada con las propuestas elevadas a la comisión (RF-4.6)',
          'Lista completa ordenada por recientes, con barra de progreso hacia el umbral (RF-4.7)',
          'Votar y retirar el voto (RF-4.2)',
          'Nueva propuesta (RF-4.1)',
        ]}
      />
    </Screen>
  );
}
