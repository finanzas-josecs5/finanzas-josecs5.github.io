import { CERO, centimos, type Centimos } from '../nucleo/dinero';
import type { FechaISO } from '../nucleo/fechas';

// Cálculos puros de la lista de movimientos (SPEC F4, F7).
export interface MovimientoBasico {
  fecha: FechaISO;
  importe: Centimos;
  sentido: 'entrada' | 'salida';
  categoria_id: string;
  naturaleza: 'fijo' | 'variable';
}

export interface Totales {
  entradas: Centimos;
  salidas: Centimos;
  balance: Centimos;
}

export function totales(movimientos: readonly MovimientoBasico[]): Totales {
  let entradas = 0;
  let salidas = 0;
  for (const m of movimientos) {
    if (m.sentido === 'entrada') entradas += m.importe;
    else salidas += m.importe;
  }
  return { entradas: centimos(entradas), salidas: centimos(salidas), balance: centimos(entradas - salidas) };
}

/** Importe con signo: positivo si entra, negativo si sale. */
export function importeConSigno(m: Pick<MovimientoBasico, 'importe' | 'sentido'>): Centimos {
  return m.sentido === 'entrada' ? m.importe : centimos(0 - m.importe);
}

/** Agrupa por día manteniendo el orden recibido (de más reciente a más antiguo). */
export function agruparPorDia<T extends MovimientoBasico>(movimientos: readonly T[]): { fecha: FechaISO; movimientos: T[]; neto: Centimos }[] {
  const grupos: { fecha: FechaISO; movimientos: T[]; neto: Centimos }[] = [];
  for (const m of movimientos) {
    let grupo = grupos.at(-1);
    if (grupo?.fecha !== m.fecha) {
      grupo = { fecha: m.fecha, movimientos: [], neto: CERO };
      grupos.push(grupo);
    }
    grupo.movimientos.push(m);
    grupo.neto = centimos(grupo.neto + importeConSigno(m));
  }
  return grupos;
}

export interface Filtro {
  categoriaId: string | null;
  naturaleza: 'fijo' | 'variable' | null;
}

export function filtrar<T extends MovimientoBasico>(movimientos: readonly T[], filtro: Filtro): T[] {
  return movimientos.filter(
    (m) =>
      (filtro.categoriaId === null || m.categoria_id === filtro.categoriaId) &&
      (filtro.naturaleza === null || m.naturaleza === filtro.naturaleza),
  );
}
