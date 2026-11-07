import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Volver' }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
    </Stack>
  );
}
