import { diasEntre, hoy, type FechaISO } from '../nucleo/fechas';
import respaldo from './ipc-respaldo.json';

// Inflación del INE servida por el propio sitio (/datos/ipc.json, generado en el build; SPEC §4.9.1)
export interface DatosIpc {
  serie: string;
  ultimo: { periodo: string; valor: number; tipo: string };
  media10: { desde: number; hasta: number; valor: number } | null;
  obtenido: string;
  fuente: string;
  respaldo?: boolean;
}

export type OrigenInflacion = 'ultimo' | 'media10' | 'manual';

export const DIAS_DESACTUALIZADO = 45;

export async function cargarIpc(): Promise<DatosIpc> {
  try {
    const respuesta = await fetch('/datos/ipc.json', { cache: 'no-cache' });
    if (!respuesta.ok) throw new Error(String(respuesta.status));
    const datos: unknown = await respuesta.json();
    return datos as DatosIpc;
  } catch {
    return respaldo;
  }
}

/** CA10.2: el dato tiene más de 45 días (por ejemplo, si el workflow programado se desactivó). */
export function estaDesactualizado(ipc: DatosIpc, referencia: FechaISO = hoy()): boolean {
  const obtenido = ipc.obtenido.slice(0, 10) as FechaISO;
  return diasEntre(obtenido, referencia) > DIAS_DESACTUALIZADO;
}

/** Inflación (fracción) según el origen elegido; null si no se puede calcular. */
export function inflacionElegida(ipc: DatosIpc, origen: OrigenInflacion, manual: number): number | null {
  if (origen === 'manual') return manual;
  if (origen === 'media10') return ipc.media10 ? ipc.media10.valor / 100 : null;
  return ipc.ultimo.valor / 100;
}
