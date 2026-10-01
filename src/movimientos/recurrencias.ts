import type { Centimos } from '../nucleo/dinero';
import { claveMes, mesesEntre, sumarMeses, ultimoDiaDelMes, type ClaveMes, type FechaISO } from '../nucleo/fechas';

// Ocurrencias de gastos e ingresos recurrentes (SPEC §4.3, CA4.4). Funciones puras.
export type Frecuencia = 'mensual' | 'trimestral' | 'anual' | 'cada_n_meses';

export interface Recurrencia {
  id: string;
  espacio_id: string;
  sentido: 'entrada' | 'salida';
  importe: Centimos;
  categoria_id: string;
  naturaleza: 'fijo' | 'variable';
  concepto: string | null;
  comercio: string | null;
  pagado_por: string;
  frecuencia: Frecuencia;
  cada_n: number;
  desde: FechaISO;
  hasta: FechaISO | null;
}

export type ReglaRecurrencia = Pick<Recurrencia, 'frecuencia' | 'cada_n' | 'desde' | 'hasta'>;

export function pasoEnMeses(r: Pick<Recurrencia, 'frecuencia' | 'cada_n'>): number {
  switch (r.frecuencia) {
    case 'mensual':
      return 1;
    case 'trimestral':
      return 3;
    case 'anual':
      return 12;
    case 'cada_n_meses':
      return Math.max(1, Math.trunc(r.cada_n));
  }
}

/**
 * Fecha de la ocurrencia en un mes, o null si no toca. Se usa el día de «desde»; si el mes
 * es más corto (un 31 en septiembre, un 29 en febrero), cae en su último día.
 */
export function ocurrenciaEnMes(r: ReglaRecurrencia, mes: ClaveMes): FechaISO | null {
  const diferencia = mesesEntre(claveMes(r.desde), mes);
  if (diferencia < 0 || diferencia % pasoEnMeses(r) !== 0) return null;
  const dia = Math.min(Number(r.desde.slice(8, 10)), ultimoDiaDelMes(mes));
  const fecha = `${mes}-${String(dia).padStart(2, '0')}` as FechaISO;
  if (r.hasta && fecha > r.hasta) return null;
  return fecha;
}

export function ocurrenciasEntre(r: ReglaRecurrencia, primerMes: ClaveMes, ultimoMes: ClaveMes): FechaISO[] {
  const fechas: FechaISO[] = [];
  for (let mes = primerMes; mesesEntre(mes, ultimoMes) >= 0; mes = sumarMeses(mes, 1)) {
    const fecha = ocurrenciaEnMes(r, mes);
    if (fecha) fechas.push(fecha);
  }
  return fechas;
}

/** Próxima ocurrencia a partir de `desdeFecha` (incluida), o null si la recurrencia ya terminó. */
export function proximaOcurrencia(r: ReglaRecurrencia, desdeFecha: FechaISO): FechaISO | null {
  const inicio = r.desde > desdeFecha ? r.desde : desdeFecha;
  let mes = claveMes(inicio);
  for (let i = 0; i <= pasoEnMeses(r); i += 1, mes = sumarMeses(mes, 1)) {
    const fecha = ocurrenciaEnMes(r, mes);
    if (fecha && fecha >= inicio) return fecha;
  }
  return null;
}

export interface Pendiente<R extends ReglaRecurrencia> {
  recurrencia: R;
  ocurrencia: FechaISO;
}

/** Ocurrencias del mes que aún no se han confirmado (no hay movimiento con esa recurrencia y fecha prevista). */
export function pendientesDelMes<R extends ReglaRecurrencia & { id: string }>(
  recurrencias: readonly R[],
  mes: ClaveMes,
  confirmadas: readonly { recurrencia_id: string | null; ocurrencia: string | null }[],
): Pendiente<R>[] {
  const hechas = new Set(confirmadas.map((c) => `${c.recurrencia_id}|${c.ocurrencia}`));
  const pendientes: Pendiente<R>[] = [];
  for (const recurrencia of recurrencias) {
    const ocurrencia = ocurrenciaEnMes(recurrencia, mes);
    if (ocurrencia && !hechas.has(`${recurrencia.id}|${ocurrencia}`)) pendientes.push({ recurrencia, ocurrencia });
  }
  return pendientes.sort((a, b) => a.ocurrencia.localeCompare(b.ocurrencia));
}

export function describirFrecuencia(r: Pick<Recurrencia, 'frecuencia' | 'cada_n'>): string {
  const paso = pasoEnMeses(r);
  if (paso === 1) return 'Cada mes';
  if (paso === 12) return 'Cada año';
  return `Cada ${paso} meses`;
}
