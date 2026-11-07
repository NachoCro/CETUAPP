import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = Colors[scheme];

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, primary: c.accent, background: c.background, card: c.backgroundElement, text: c.text, border: c.line },
      }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { loading, session, isAdmin, hasRole } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  const loggedIn = Boolean(session);

  // Los guards solo ordenan la navegación; la seguridad real está en las políticas RLS.
  return (
    <Stack screenOptions={{ headerBackTitle: 'Volver' }}>
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={loggedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="verificacion" options={{ title: 'Verificar cuenta' }} />
        <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones' }} />
        <Stack.Screen name="perfil" options={{ title: 'Mi perfil' }} />

        <Stack.Protected guard={isAdmin}>
          <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={hasRole('comunicacion')}>
          <Stack.Screen name="comunicacion" options={{ title: 'Comunicación' }} />
        </Stack.Protected>
        <Stack.Protected guard={hasRole('fotocopiadora') || isAdmin}>
          <Stack.Screen name="fotocopiadora" options={{ title: 'Fotocopiadora' }} />
        </Stack.Protected>
        <Stack.Protected guard={hasRole('comision') || isAdmin}>
          <Stack.Screen name="comision" options={{ title: 'Comisión directiva' }} />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
}
