import { supabase } from '../cliente';

// Ajustes personales (migración 005): parámetros del simulador y umbrales de los consejos.
export interface Ajustes {
  simulador: Record<string, unknown>;
  umbrales: Record<string, unknown>;
}

export async function obtenerAjustes(): Promise<Ajustes> {
  const { data } = await supabase().from('ajustes').select('simulador, umbrales').maybeSingle<Ajustes>();
  return data ?? { simulador: {}, umbrales: {} };
}

export async function guardarAjustes(cambios: Partial<Ajustes>): Promise<void> {
  const { data: sesion } = await supabase().auth.getSession();
  const userId = sesion.session?.user.id;
  if (!userId) return;
  await supabase().from('ajustes').upsert({ user_id: userId, ...cambios }, { onConflict: 'user_id' });
}
