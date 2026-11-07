import { Banner, Body, Button, Card, Heading, Screen, Upcoming } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { MEMBER_TYPE_LABEL } from '@/lib/types';

const STATUS_TEXT = {
  pendiente: 'Pendiente de verificación',
  verificado: 'Cuenta verificada',
  rechazado: 'Verificación rechazada',
  suspendido: 'Cuenta suspendida',
} as const;

export default function VerificacionScreen() {
  const { profile, refresh } = useAuth();
  const status = profile?.verification_status ?? 'pendiente';
  const memberType = profile?.member_type ?? 'alumno';

  return (
    <Screen title="Verificar cuenta" hideVerificationBanner>
      <Banner tone={status === 'verificado' ? 'info' : status === 'pendiente' ? 'highlight' : 'danger'}>
        {STATUS_TEXT[status]} · {MEMBER_TYPE_LABEL[memberType]}
      </Banner>

      {memberType !== 'alumno' ? (
        <Body muted>
          Tu cuenta figura como {MEMBER_TYPE_LABEL[memberType].toLowerCase()}. Si sos estudiante, avisale al CETU para
          que la corrija.
        </Body>
      ) : status !== 'verificado' ? (
        <>
          <Card>
            <Heading>El CETU revisa tu cuenta</Heading>
            <Body muted>
              {profile?.institutional_email
                ? 'Confirmaste tu mail @frsn.utn.edu.ar: solo falta que el CETU te confirme como alumno/a.'
                : 'Como no usaste un mail @frsn.utn.edu.ar, la forma más rápida es subir tu certificado.'}
            </Body>
          </Card>
          <Card>
            <Heading>Con tu certificado de alumno regular</Heading>
            <Body muted>Subí el certificado (PDF o foto) y un miembro del CETU lo revisa.</Body>
          </Card>
          <Upcoming items={['Subir certificado y ver el estado de la solicitud']} />
        </>
      ) : null}

      <Button title="Actualizar estado" variant="ghost" onPress={refresh} />
    </Screen>
  );
}
