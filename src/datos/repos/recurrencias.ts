import type { Recurrencia } from '../../movimientos/recurrencias';
import { ultimoDiaDelMes, type ClaveMes } from '../../nucleo/fechas';
import { supabase } from '../cliente';

export type DatosRecurrencia = Omit<Recurrencia, 'id' | 'pagado_por'>;

const COLUMNAS =
  'id, espacio_id, sentido, importe, categoria_id, naturaleza, concepto, comercio, pagado_por, frecuencia, cada_n, desde, hasta';

function fallo(accion: string): never {
  throw new Error(`No se ha podido ${accion}. Comprueba la conexión e inténtalo de nuevo.`);
}

export async function listarRecurrencias(espacioId: string): Promise<Recurrencia[]> {
  const { data, error } = await supabase()
    .from('recurrencias')
    .select(COLUMNAS)
    .eq('espacio_id', espacioId)
    .order('sentido')
    .order('desde')
    .returns<Recurrencia[]>();
  if (error) fallo('cargar los recurrentes');
  return data;
}

export async function obtenerRecurrencia(id: string): Promise<Recurrencia | null> {
  const { data, error } = await supabase().from('recurrencias').select(COLUMNAS).eq('id', id).maybeSingle<Recurrencia>();
  if (error) fallo('cargar el recurrente');
  return data;
}

export async function crearRecurrencia(datos: DatosRecurrencia): Promise<void> {
  const { error } = await supabase().from('recurrencias').insert(datos);
  if (error) fallo('guardar el recurrente');
}

export async function actualizarRecurrencia(id: string, datos: DatosRecurrencia): Promise<void> {
  const { error } = await supabase().from('recurrencias').update(datos).eq('id', id);
  if (error) fallo('guardar los cambios');
}

export async function borrarRecurrencia(id: string): Promise<void> {
  const { error } = await supabase().from('recurrencias').delete().eq('id', id);
  if (error) fallo('borrar el recurrente');
}

/** Ocurrencias ya confirmadas en un mes (para no volver a ofrecerlas como pendientes). */
export async function ocurrenciasConfirmadas(
  espacioId: string,
  mes: ClaveMes,
): Promise<{ recurrencia_id: string | null; ocurrencia: string | null }[]> {
  const { data, error } = await supabase()
    .from('movimientos')
    .select('recurrencia_id, ocurrencia')
    .eq('espacio_id', espacioId)
    .not('recurrencia_id', 'is', null)
    .gte('ocurrencia', `${mes}-01`)
    .lte('ocurrencia', `${mes}-${String(ultimoDiaDelMes(mes)).padStart(2, '0')}`)
    .returns<{ recurrencia_id: string | null; ocurrencia: string | null }[]>();
  if (error) fallo('cargar los recurrentes del mes');
  return data;
}
