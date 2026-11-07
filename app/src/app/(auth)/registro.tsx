import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Chips } from '@/components/chips';
import { Banner, Body, Button, Field, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { MEMBER_TYPE_LABEL, type MemberType } from '@/lib/types';

const MEMBER_OPTIONS = (Object.keys(MEMBER_TYPE_LABEL) as MemberType[]).map((value) => ({
  value,
  label: MEMBER_TYPE_LABEL[value],
}));

export default function RegistroScreen() {
  const t = useTheme();
  const [memberType, setMemberType] = useState<MemberType>('alumno');
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [legajo, setLegajo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    if (password.length < 8) {
      setError('La contraseña tiene que tener al menos 8 caracteres.');
      return;
    }
    setBusy(true);
    // El perfil lo crea el trigger handle_auth_user() con estos datos.
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), dni: dni.trim(), legajo: legajo.trim(), member_type: memberType },
      },
    });
    setBusy(false);
    if (error) {
      setError(
        /duplicate|already/i.test(error.message)
          ? 'Ya existe una cuenta con ese mail, DNI o legajo.'
          : 'No pudimos crear la cuenta. Revisá los datos y probá de nuevo.',
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Screen title="¡Listo!" hideVerificationBanner>
        <Body>Te mandamos un mail para confirmar tu cuenta.</Body>
        <Body muted>
          Después, el CETU revisa y verifica tu cuenta. Si usaste tu mail @frsn.utn.edu.ar, la revisión es más
          rápida. Si usaste otro mail, también podés subir tu certificado de alumno regular.
        </Body>
      </Screen>
    );
  }

  return (
    <Screen title="Crear cuenta" subtitle="Si tenés mail @frsn.utn.edu.ar, usalo: tu verificación es más rápida" hideVerificationBanner>
      <View style={styles.group}>
        <Text style={[styles.label, { color: t.text }]}>Soy</Text>
        <Chips options={MEMBER_OPTIONS} value={memberType} onChange={setMemberType} />
      </View>
      {memberType !== 'alumno' ? (
        <Banner>
          La app está pensada para estudiantes: con una cuenta de {MEMBER_TYPE_LABEL[memberType].toLowerCase()} vas a
          poder ver noticias y contenido, pero no las funciones de estudiante.
        </Banner>
      ) : null}
      <Field label="Nombre y apellido" value={fullName} onChangeText={setFullName} autoComplete="name" />
      <Field label="DNI" value={dni} onChangeText={setDni} keyboardType="number-pad" />
      {memberType === 'alumno' ? <Field label="Legajo (opcional)" value={legajo} onChangeText={setLegajo} /> : null}
      <Field label="Mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Body muted>El DNI y el legajo no se pueden cambiar después: se usan para verificarte y para consultar el padrón.</Body>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button title="Crear cuenta" onPress={onSubmit} loading={busy} disabled={!fullName || !dni || !email || !password} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 8 },
  label: { fontSize: 14, fontWeight: '600' },
});
