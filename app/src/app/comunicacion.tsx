import { Banner, Screen, Upcoming } from '@/components/ui';

export default function ComunicacionScreen() {
  return (
    <Screen title="Comunicación" hideVerificationBanner>
      <Banner>En período electoral, las publicaciones oficiales no promocionan a ninguna lista.</Banner>
      <Upcoming
        items={[
          'Publicar noticias con imagen, categoría, fijado y programación (RF-6.1 – 6.3)',
          'Notificación push / email, a todos o por carrera y año (RF-6.4)',
          'Eventos con fecha, lugar y recordatorio (RF-6.7 – 6.9)',
          'Cargar elecciones, listas y candidatos (RF-6.11 – 6.13)',
          'Estadísticas de alcance (RF-6.6)',
        ]}
      />
    </Screen>
  );
}
