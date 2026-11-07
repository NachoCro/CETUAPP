import { Banner, Screen, Upcoming } from '@/components/ui';

export default function EleccionesScreen() {
  return (
    <Screen title="Elecciones" subtitle="Información de las elecciones del CETU">
      <Banner>En la app no se vota: acá encontrás la información para ir a votar.</Banner>
      <Upcoming
        items={[
          'Fecha, horario y lugar de votación (RF-6.11)',
          'Listas que se presentan, con propuestas y candidatos (RF-6.12, 6.13)',
          'Consultá si estás en el padrón y en qué mesa votás (RF-6.14)',
        ]}
      />
    </Screen>
  );
}
