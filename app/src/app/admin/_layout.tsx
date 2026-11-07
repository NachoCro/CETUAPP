import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Volver' }}>
      <Stack.Screen name="index" options={{ title: 'Panel del CETU' }} />
      <Stack.Screen name="usuarios/index" options={{ title: 'Usuarios' }} />
      <Stack.Screen name="usuarios/[id]" options={{ title: 'Usuario' }} />
      <Stack.Screen name="verificaciones" options={{ title: 'Certificados' }} />
      <Stack.Screen name="catalogo" options={{ title: 'Catálogo académico' }} />
      <Stack.Screen name="configuracion" options={{ title: 'Configuración' }} />
    </Stack>
  );
}
