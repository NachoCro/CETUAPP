import { Banner, Screen, Upcoming } from '@/components/ui';

export default function AsistenteScreen() {
  return (
    <Screen title="Asistente" subtitle="Te guía en trámites y redacta por vos">
      <Banner>La información es orientativa y no oficial: confirmala con la oficina correspondiente.</Banner>
      <Upcoming
        items={[
          'Chat con IA sobre trámites cargados por el CETU (RF-5.1 – 5.4)',
          'Redacción de notas y reclamos formales, para copiar o descargar en PDF (RF-5.3, 5.6)',
          'Pasar la redacción a un reclamo del CETU (RF-5.7)',
        ]}
      />
    </Screen>
  );
}
