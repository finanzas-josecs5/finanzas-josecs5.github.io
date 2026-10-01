import type { ConfigNomina } from '../../movimientos/nomina';
import { supabase } from '../cliente';

// La nómina es personal: la RLS solo devuelve la del usuario conectado (SPEC CA2.1).
export async function obtenerNomina(): Promise<ConfigNomina | null> {
  const { data, error } = await supabase()
    .from('nomina')
    .select('pagas, neto_ordinario, neto_extra, meses_extra')
    .maybeSingle<ConfigNomina>();
  if (error) throw new Error('No se ha podido cargar la nómina.');
  return data;
}

export async function guardarNomina(datos: ConfigNomina): Promise<void> {
  const { data: sesion } = await supabase().auth.getSession();
  const userId = sesion.session?.user.id;
  if (!userId) throw new Error('La sesión ha caducado. Vuelve a entrar.');
  const { error } = await supabase()
    .from('nomina')
    .upsert({ user_id: userId, ...datos }, { onConflict: 'user_id' });
  if (error) throw new Error('No se ha podido guardar la nómina. Comprueba los importes.');
}
