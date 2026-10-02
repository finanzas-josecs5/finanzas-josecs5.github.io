import { mensajeErrorEspacios } from '../../espacios/compartir';
import { supabase } from '../cliente';

export interface Miembro {
  user_id: string;
  email: string;
  porcentaje_defecto: number;
}

// Los espacios compartidos solo se crean y se comparten con funciones del servidor
// (migración 006): el cliente no puede escribir en espacios ni en miembros.
export async function crearEspacioCompartido(nombre: string): Promise<string> {
  // Sin tipos generados, supabase-js da `any`: se trata como unknown y se comprueba
  const respuesta = await supabase().rpc('crear_espacio_compartido', { p_nombre: nombre.trim() });
  if (respuesta.error) throw new Error(mensajeErrorEspacios(respuesta.error.code));
  const id: unknown = respuesta.data;
  if (typeof id !== 'string') throw new Error(mensajeErrorEspacios(undefined));
  return id;
}

export async function anadirMiembro(espacioId: string, email: string): Promise<void> {
  const { error } = await supabase().rpc('anadir_miembro', { p_espacio: espacioId, p_email: email.trim() });
  if (error) throw new Error(mensajeErrorEspacios(error.code));
}

/** Miembros con su email; solo responde si quien pregunta es miembro del espacio. */
export async function listarMiembros(espacioId: string): Promise<Miembro[]> {
  const respuesta = await supabase().rpc('miembros_del_espacio', { p_espacio: espacioId });
  const filas: unknown = respuesta.data;
  if (respuesta.error || !Array.isArray(filas)) throw new Error('No se han podido cargar los miembros.');
  return filas as Miembro[];
}

export async function idUsuarioActual(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user.id ?? null;
}
