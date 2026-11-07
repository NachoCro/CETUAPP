import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export type Bucket = 'noticias' | 'apuntes' | 'pedidos' | 'reclamos' | 'verificaciones';

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  /** Solo en web: el File del navegador. */
  file?: Blob;
};

export const MB = 1024 * 1024;

export class FileTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`El archivo supera el máximo de ${Math.round(maxBytes / MB)} MB.`);
  }
}

/** Abre el selector de archivos. Devuelve null si el usuario cancela. */
export async function pickDocument(opts: { types: string[]; maxBytes: number }): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: opts.types, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  if (a.size && a.size > opts.maxBytes) throw new FileTooLargeError(opts.maxBytes);
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', size: a.size, file: a.file };
}

/** Abre la galería para elegir fotos (reclamos, verificación). */
export async function pickImages(opts: { multiple?: boolean; maxBytes: number }): Promise<PickedFile[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: opts.multiple ?? false,
    quality: 0.8,
  });
  if (res.canceled) return [];
  return res.assets.map((a, i) => {
    if (a.fileSize && a.fileSize > opts.maxBytes) throw new FileTooLargeError(opts.maxBytes);
    return {
      uri: a.uri,
      name: a.fileName ?? `foto-${i + 1}.jpg`,
      mimeType: a.mimeType ?? 'image/jpeg',
      size: a.fileSize,
      file: a.file,
    };
  });
}

/** Nombre de archivo seguro para Storage: sin acentos, espacios ni símbolos raros. */
function safeName(name: string) {
  const clean = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80);
  return `${Date.now()}-${clean || 'archivo'}`;
}

/**
 * Sube un archivo a `<bucket>/<folder>/<timestamp>-<nombre>` y devuelve la ruta.
 * La carpeta define los permisos (ver políticas de storage en la migración):
 * id del usuario para apuntes/pedidos/verificaciones, id del reclamo para reclamos.
 */
export async function uploadFile(bucket: Bucket, folder: string, picked: PickedFile): Promise<string> {
  const path = `${folder}/${safeName(picked.name)}`;
  const body =
    Platform.OS === 'web' && picked.file ? picked.file : await fetch(picked.uri).then((r) => r.arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: picked.mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** URL temporal para ver/descargar un archivo de un bucket privado. */
export async function signedUrl(bucket: Bucket, path: string, expiresInSeconds = 60 * 10): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/** Abre un archivo privado (PDF, foto) en el navegador / visor del sistema. */
export async function openPrivateFile(bucket: Bucket, path: string): Promise<void> {
  const url = await signedUrl(bucket, path);
  await WebBrowser.openBrowserAsync(url);
}

/** URL pública (solo bucket "noticias"). */
export function publicUrl(path: string): string {
  return supabase.storage.from('noticias').getPublicUrl(path).data.publicUrl;
}
