import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

// Máximo 5 pestañas para que entren en el celular. Propuestas, Asistente y
// Elecciones viven dentro de (tabs) para conservar la barra, pero se llegan desde Inicio y "Más".
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textSecondary,
        tabBarStyle: { backgroundColor: t.backgroundElement, borderTopColor: t.line },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="apuntes" options={{ title: 'Apuntes', tabBarIcon: icon('book-outline') }} />
      <Tabs.Screen name="copias" options={{ title: 'Copias', tabBarIcon: icon('print-outline') }} />
      <Tabs.Screen name="reclamos" options={{ title: 'Reclamos', tabBarIcon: icon('alert-circle-outline') }} />
      <Tabs.Screen name="mas" options={{ title: 'Más', tabBarIcon: icon('menu-outline') }} />

      <Tabs.Screen name="propuestas" options={{ href: null }} />
      <Tabs.Screen name="asistente" options={{ href: null }} />
      <Tabs.Screen name="elecciones" options={{ href: null }} />
    </Tabs>
  );
}
