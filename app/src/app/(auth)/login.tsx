import { Link } from 'expo-router';
import { useState } from 'react';

import { Banner, Body, Button, Field, Screen } from '@/components/ui';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Mail o contraseña incorrectos.'
          : error.message === 'Email not confirmed'
            ? 'Todavía no confirmaste tu mail. Revisá tu bandeja de entrada.'
            : 'No pudimos iniciar sesión. Probá de nuevo.',
      );
    }
    // Si sale bien, el guard del layout raíz redirige a las pestañas.
  }

  return (
    <Screen title="CETU de bolsillo" subtitle="Apuntes, copias, reclamos, propuestas y trámites en un solo lugar">
      {!isSupabaseConfigured ? (
        <Banner tone="danger">
          Falta configurar Supabase: copiá .env.example a .env.local y completá la URL y la clave.
        </Banner>
      ) : null}
      <Field label="Mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button title="Ingresar" onPress={onSubmit} loading={busy} disabled={!email || !password} />
      <Body muted>
        ¿No tenés cuenta? <Link href="/registro">Registrate</Link>
      </Body>
    </Screen>
  );
}
