import { createClient } from '@supabase/supabase-js';

// Ayudas para los e2e contra el Supabase LOCAL del CI (nunca producción).
// La service role key es la clave local por defecto de la CLI: solo existe en ese contenedor.
const url = process.env.VITE_SUPABASE_URL;
const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hayBackendDePrueba = Boolean(url && claveServicio && /^http:\/\/(127\.0\.0\.1|localhost)/.test(url));

export const CONTRASENA_TEMPORAL = 'Temporal-2026!x';

export interface UsuarioPrueba {
  id: string;
  email: string;
  contrasena: string;
}

function admin() {
  if (!url || !claveServicio || !hayBackendDePrueba) throw new Error('Solo contra el Supabase local de pruebas');
  return createClient(url, claveServicio, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Crea un usuario como lo haría el administrador desde el panel. */
export async function crearUsuario(opciones: { primerAcceso?: boolean } = {}): Promise<UsuarioPrueba> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@prueba.local`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: CONTRASENA_TEMPORAL,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('No se pudo crear el usuario');
  if (!opciones.primerAcceso) {
    await admin().auth.admin.updateUserById(data.user.id, { user_metadata: { debe_cambiar_contrasena: false } });
  }
  return { id: data.user.id, email, contrasena: CONTRASENA_TEMPORAL };
}
