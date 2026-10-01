import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// SPEC §8.2 (S8): en el frontend solo van la URL del proyecto y la publishable key,
// que es pública por diseño. Llegan en el build como variables del repositorio.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const backendConfigurado = Boolean(url && clave);

let cliente: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (!url || !clave) throw new Error('Supabase no está configurado en este build');
  cliente ??= createClient(url, clave, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // La app no usa flujos con redirección (sin OAuth ni enlaces mágicos)
      detectSessionInUrl: false,
      storageKey: 'finanzas-sesion',
    },
  });
  return cliente;
}
