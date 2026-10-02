import type { Liquidacion, MovimientoComun } from '../../comun/saldo';
import type { FechaISO } from '../../nucleo/fechas';
import { supabase } from '../cliente';

export interface LiquidacionGuardada extends Liquidacion {
  id: string;
  fecha: FechaISO;
  nota: string | null;
}

function fallo(accion: string): never {
  throw new Error(`No se ha podido ${accion}. Comprueba la conexión e inténtalo de nuevo.`);
}

/** Todos los movimientos de un espacio compartido, con lo justo para calcular el saldo. */
export async function movimientosParaSaldo(espacioId: string): Promise<(MovimientoComun & { fecha: FechaISO })[]> {
  const { data, error } = await supabase()
    .from('movimientos')
    .select('importe, sentido, pagado_por, reparto, fecha')
    .eq('espacio_id', espacioId)
    .order('fecha')
    .returns<(MovimientoComun & { fecha: FechaISO })[]>();
  if (error) fallo('calcular el saldo');
  return data;
}

export async function listarLiquidaciones(espacioId: string): Promise<LiquidacionGuardada[]> {
  const { data, error } = await supabase()
    .from('liquidaciones')
    .select('id, de_user, a_user, importe, fecha, nota')
    .eq('espacio_id', espacioId)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })
    .returns<LiquidacionGuardada[]>();
  if (error) fallo('cargar las liquidaciones');
  return data;
}

export async function crearLiquidacion(espacioId: string, l: Liquidacion & { fecha: FechaISO; nota: string | null }): Promise<void> {
  const { error } = await supabase().from('liquidaciones').insert({ espacio_id: espacioId, ...l });
  if (error) fallo('registrar el pago');
}
