import type { Aportacion, Valoracion } from '../../cartera/cartera';
import type { Centimos } from '../../nucleo/dinero';
import type { FechaISO } from '../../nucleo/fechas';
import { supabase } from '../cliente';

// La cartera es personal: la RLS solo devuelve los fondos del usuario conectado (SPEC CA2.1).
export interface Fondo {
  id: string;
  nombre: string;
  isin: string;
  ter: number;
}

export interface AportacionGuardada extends Aportacion {
  id: string;
  fondo_id: string;
  participaciones: number | null;
}

export interface ValoracionGuardada extends Valoracion {
  id: string;
  fondo_id: string;
}

function fallo(accion: string): never {
  throw new Error(`No se ha podido ${accion}. Comprueba la conexión e inténtalo de nuevo.`);
}

export async function listarFondos(): Promise<Fondo[]> {
  const { data, error } = await supabase().from('fondos').select('id, nombre, isin, ter').order('nombre').returns<Fondo[]>();
  if (error) fallo('cargar los fondos');
  return data.map((f) => ({ ...f, ter: Number(f.ter) }));
}

export async function obtenerFondo(id: string): Promise<Fondo | null> {
  const { data, error } = await supabase().from('fondos').select('id, nombre, isin, ter').eq('id', id).maybeSingle<Fondo>();
  if (error) fallo('cargar el fondo');
  return data ? { ...data, ter: Number(data.ter) } : null;
}

export async function guardarFondo(datos: Omit<Fondo, 'id'>, id?: string): Promise<string> {
  const consulta = id
    ? supabase().from('fondos').update(datos).eq('id', id).select('id').single<{ id: string }>()
    : supabase().from('fondos').insert(datos).select('id').single<{ id: string }>();
  const { data, error } = await consulta;
  if (error?.code === '23505') throw new Error('Ya tienes un fondo con ese ISIN.');
  if (error) fallo('guardar el fondo');
  return data.id;
}

export async function borrarFondo(id: string): Promise<void> {
  const { error } = await supabase().from('fondos').delete().eq('id', id);
  if (error) fallo('borrar el fondo');
}

/** Aportaciones y valoraciones de todos los fondos (o de uno), para los indicadores. */
export async function movimientosCartera(fondoId?: string): Promise<{ aportaciones: AportacionGuardada[]; valoraciones: ValoracionGuardada[] }> {
  let aportaciones = supabase().from('aportaciones').select('id, fondo_id, fecha, importe, participaciones').order('fecha', { ascending: false });
  let valoraciones = supabase().from('valoraciones').select('id, fondo_id, fecha, valor').order('fecha', { ascending: false });
  if (fondoId) {
    aportaciones = aportaciones.eq('fondo_id', fondoId);
    valoraciones = valoraciones.eq('fondo_id', fondoId);
  }
  const [a, v] = await Promise.all([aportaciones.returns<AportacionGuardada[]>(), valoraciones.returns<ValoracionGuardada[]>()]);
  if (a.error || v.error) fallo('cargar la cartera');
  return { aportaciones: a.data, valoraciones: v.data };
}

export async function crearAportacion(d: { fondo_id: string; fecha: FechaISO; importe: Centimos; participaciones: number | null }): Promise<void> {
  const { error } = await supabase().from('aportaciones').insert(d);
  if (error) fallo('guardar la aportación');
}

/** Una valoración por fondo y día: si ya hay una ese día, se sustituye. */
export async function guardarValoracion(d: { fondo_id: string; fecha: FechaISO; valor: Centimos }): Promise<void> {
  const { error } = await supabase().from('valoraciones').upsert(d, { onConflict: 'fondo_id,fecha' });
  if (error) fallo('guardar el valor');
}

export async function borrarAportacion(id: string): Promise<void> {
  const { error } = await supabase().from('aportaciones').delete().eq('id', id);
  if (error) fallo('borrar la aportación');
}

export async function borrarValoracion(id: string): Promise<void> {
  const { error } = await supabase().from('valoraciones').delete().eq('id', id);
  if (error) fallo('borrar el valor');
}
