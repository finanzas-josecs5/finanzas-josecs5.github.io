import type { Centimos } from '../../nucleo/dinero';
import { ultimoDiaDelMes, type ClaveMes, type FechaISO } from '../../nucleo/fechas';
import { normalizarComercio } from '../../nucleo/normalizar';
import { supabase } from '../cliente';

export type Sentido = 'entrada' | 'salida';
export type Naturaleza = 'fijo' | 'variable';

export interface Categoria {
  id: string;
  espacio_id: string;
  nombre: string;
  sentido: Sentido;
  orden: number;
}

export interface Movimiento {
  id: string;
  espacio_id: string;
  fecha: FechaISO;
  importe: Centimos;
  sentido: Sentido;
  categoria_id: string;
  naturaleza: Naturaleza;
  concepto: string | null;
  comercio: string | null;
  pagado_por: string;
  origen: 'manual' | 'ocr';
  recurrencia_id: string | null;
  ocurrencia: FechaISO | null;
  creado_por: string | null;
  actualizado_por: string | null;
}

export type DatosMovimiento = Pick<
  Movimiento,
  'espacio_id' | 'fecha' | 'importe' | 'sentido' | 'categoria_id' | 'naturaleza' | 'concepto' | 'comercio'
> & {
  origen?: Movimiento['origen'];
  // Al confirmar una ocurrencia de un recurrente (SPEC CA4.4)
  recurrencia_id?: string;
  ocurrencia?: FechaISO;
};

const COLUMNAS =
  'id, espacio_id, fecha, importe, sentido, categoria_id, naturaleza, concepto, comercio, pagado_por, origen, recurrencia_id, ocurrencia, creado_por, actualizado_por';

function fallo(accion: string): never {
  throw new Error(`No se ha podido ${accion}. Comprueba la conexión e inténtalo de nuevo.`);
}

export async function listarCategorias(espacioId: string): Promise<Categoria[]> {
  const { data, error } = await supabase()
    .from('categorias')
    .select('id, espacio_id, nombre, sentido, orden')
    .eq('espacio_id', espacioId)
    .order('sentido')
    .order('orden');
  if (error) fallo('cargar las categorías');
  return data;
}

export async function listarMovimientosDelMes(espacioId: string, mes: ClaveMes): Promise<Movimiento[]> {
  const { data, error } = await supabase()
    .from('movimientos')
    .select(COLUMNAS)
    .eq('espacio_id', espacioId)
    .gte('fecha', `${mes}-01`)
    .lte('fecha', `${mes}-${String(ultimoDiaDelMes(mes)).padStart(2, '0')}`)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false });
  if (error) fallo('cargar los movimientos');
  return data;
}

export async function obtenerMovimiento(id: string): Promise<Movimiento | null> {
  const { data, error } = await supabase().from('movimientos').select(COLUMNAS).eq('id', id).maybeSingle();
  if (error) fallo('cargar el movimiento');
  return data;
}

export async function crearMovimiento(datos: DatosMovimiento): Promise<void> {
  const { error } = await supabase().from('movimientos').insert(datos);
  if (error) fallo('guardar el movimiento');
}

export async function actualizarMovimiento(id: string, datos: DatosMovimiento): Promise<void> {
  const { error } = await supabase().from('movimientos').update(datos).eq('id', id);
  if (error) fallo('guardar los cambios');
}

export async function borrarMovimiento(id: string): Promise<void> {
  const { error } = await supabase().from('movimientos').delete().eq('id', id);
  if (error) fallo('borrar el movimiento');
}

/** Categoría usada la última vez con este comercio en el espacio (SPEC CA4.3). */
export async function categoriaRecordada(espacioId: string, comercio: string): Promise<string | null> {
  const clave = normalizarComercio(comercio);
  if (!clave) return null;
  const { data } = await supabase()
    .from('comercios')
    .select('categoria_id')
    .eq('espacio_id', espacioId)
    .eq('nombre_normalizado', clave)
    .maybeSingle<{ categoria_id: string }>();
  return data?.categoria_id ?? null;
}

export async function recordarComercio(espacioId: string, comercio: string, categoriaId: string): Promise<void> {
  const clave = normalizarComercio(comercio);
  if (!clave) return;
  // Si falla, el gasto ya está guardado: solo se pierde la sugerencia para la próxima vez
  await supabase()
    .from('comercios')
    .upsert(
      { espacio_id: espacioId, nombre_normalizado: clave, categoria_id: categoriaId, actualizado_en: new Date().toISOString() },
      { onConflict: 'espacio_id,nombre_normalizado' },
    );
}
