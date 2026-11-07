import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// En el celular, refrescar los datos al volver a la app (en web React Query ya usa el foco de la pestaña).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
  onlineManager.setOnline(true);
}

/** Convierte un error de Supabase/red en un texto para mostrar. */
export function errorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    if (/Failed to fetch|Network request failed/i.test(error.message)) return 'Sin conexión. Probá de nuevo.';
    if (/row-level security|permission denied|42501/i.test(error.message)) return 'No tenés permiso para hacer esto.';
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}
