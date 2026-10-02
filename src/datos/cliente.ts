import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// SPEC §8.2 (S8): en el frontend solo van la URL del proyecto y la publishable key,
// que es pública por diseño. Llegan en el build como variables del repositorio.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const backendConfigurado = Boolean(url && clave);

export const CLAVE_SESION = 'finanzas-sesion';

/**
 * Una consulta a los datos (PostgREST) sin sesión: supabase-js manda la clave pública como
 * token o ninguno. La app nunca consulta datos sin sesión; pasa al cerrarla con una carga a
 * medias (tras un await), y la respuesta sería un 401 inútil.
 */
export function esConsultaSinSesion(entrada: RequestInfo | URL, init: RequestInit | undefined, clavePublica: string): boolean {
  const ruta = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  if (!new URL(ruta).pathname.startsWith('/rest/')) return false;
  const token = new Headers(init?.headers).get('Authorization');
  return token === null || token === `Bearer ${clavePublica}`;
}

let cliente: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (!url || !clave) throw new Error('Supabase no está configurado en este build');
  cliente ??= createClient(url, clave, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // La app no usa flujos con redirección (sin OAuth ni enlaces mágicos)
      detectSessionInUrl: false,
      storageKey: CLAVE_SESION,
    },
    global: {
      fetch: (entrada, init) =>
        esConsultaSinSesion(entrada, init, clave)
          ? Promise.reject(new DOMException('Sin sesión', 'AbortError'))
          : fetch(entrada, init),
    },
  });
  return cliente;
}
