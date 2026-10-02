import type { Centimos } from '../../nucleo/dinero';
import type { FechaISO } from '../../nucleo/fechas';
import { supabase } from '../cliente';

// Liquidez personal (SPEC P2): la RLS solo devuelve la del usuario conectado.
export interface ApunteLiquidez {
  id: string;
  fecha: FechaISO;
  importe: Centimos;
}

export async function listarLiquidez(): Promise<ApunteLiquidez[]> {
  const { data, error } = await supabase()
    .from('liquidez')
    .select('id, fecha, importe')
    .order('fecha', { ascending: false })
    .returns<ApunteLiquidez[]>();
  if (error) throw new Error('No se ha podido cargar la liquidez.');
  return data;
}

/** Un apunte por día: si ya hay uno ese día, se sustituye. */
export async function guardarLiquidez(fecha: FechaISO, importe: Centimos): Promise<void> {
  const { data: sesion } = await supabase().auth.getSession();
  const userId = sesion.session?.user.id;
  if (!userId) throw new Error('La sesión ha caducado. Vuelve a entrar.');
  const { error } = await supabase().from('liquidez').upsert({ user_id: userId, fecha, importe }, { onConflict: 'user_id,fecha' });
  if (error) throw new Error('No se ha podido guardar la liquidez.');
}

export async function borrarLiquidez(id: string): Promise<void> {
  const { error } = await supabase().from('liquidez').delete().eq('id', id);
  if (error) throw new Error('No se ha podido borrar el apunte.');
}
