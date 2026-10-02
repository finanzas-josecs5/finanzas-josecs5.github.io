import type { MovimientoBasico } from '../movimientos/calculos';
import type { CategoriaBasica } from '../movimientos/resumen';
import type { Centimos } from '../nucleo/dinero';
import type { FechaISO } from '../nucleo/fechas';
import { parteDe, type Reparto } from './reparto';

// En el resumen de «Yo» solo cuenta tu parte de lo común (SPEC §4.6, CA6.3): lo que
// adelantas por la otra persona no es gasto tuyo, es dinero que te deben.
export interface MovimientoCompartido {
  fecha: FechaISO;
  importe: Centimos;
  sentido: 'entrada' | 'salida';
  naturaleza: 'fijo' | 'variable';
  pagado_por: string;
  reparto: Reparto | null;
}

export function categoriaComun(espacioId: string, nombreEspacio: string, sentido: 'entrada' | 'salida'): CategoriaBasica {
  return { id: `comun:${sentido}:${espacioId}`, nombre: `Común · ${nombreEspacio}`, sentido };
}

/** Los movimientos de un espacio compartido convertidos en «mi parte» (se omiten las partes de 0 €). */
export function misPartes(
  movimientos: readonly MovimientoCompartido[],
  yo: string,
  espacioId: string,
): MovimientoBasico[] {
  const resultado: MovimientoBasico[] = [];
  for (const m of movimientos) {
    if (!m.reparto) continue;
    const parte = parteDe(yo, m.importe, m.pagado_por, m.reparto);
    if (parte <= 0) continue;
    resultado.push({
      fecha: m.fecha,
      importe: parte,
      sentido: m.sentido,
      naturaleza: m.naturaleza,
      categoria_id: `comun:${m.sentido}:${espacioId}`,
    });
  }
  return resultado;
}
