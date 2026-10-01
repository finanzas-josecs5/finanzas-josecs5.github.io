import { centimos, type Centimos } from '../nucleo/dinero';
import { claveMes, type ClaveMes } from '../nucleo/fechas';
import type { MovimientoBasico } from './calculos';

// Histórico por meses (SPEC §4.4, CA7.2). Funciones puras.
export interface MesHistorico {
  mes: ClaveMes;
  entradas: Centimos;
  salidas: Centimos;
  balance: Centimos;
}

export function serieMensual(movimientos: readonly MovimientoBasico[], meses: readonly ClaveMes[]): MesHistorico[] {
  const filas = meses.map((mes) => ({ mes, entradas: 0, salidas: 0 }));
  const porMes = new Map(filas.map((f) => [f.mes as string, f]));
  for (const m of movimientos) {
    const fila = porMes.get(claveMes(m.fecha));
    if (!fila) continue;
    if (m.sentido === 'entrada') fila.entradas += m.importe;
    else fila.salidas += m.importe;
  }
  return filas.map(({ mes, entradas, salidas }) => ({
    mes,
    entradas: centimos(entradas),
    salidas: centimos(salidas),
    balance: centimos(entradas - salidas),
  }));
}

/**
 * Media de los meses indicados (CA7.2: solo meses completos, nunca el mes en curso).
 * Devuelve null si no hay ningún mes con datos en la serie para esos meses.
 */
export function mediaDeMeses(serie: readonly MesHistorico[], meses: readonly ClaveMes[]): Omit<MesHistorico, 'mes'> | null {
  const elegidos = serie.filter((s) => meses.includes(s.mes));
  if (elegidos.length === 0) return null;
  const media = (f: (s: MesHistorico) => number) => centimos(Math.round(elegidos.reduce((t, s) => t + f(s), 0) / elegidos.length));
  return { entradas: media((s) => s.entradas), salidas: media((s) => s.salidas), balance: media((s) => s.balance) };
}

/** Eje con valores redondos: máximo y paso de 1, 2 o 5 × 10ⁿ, con unas 4 marcas. */
export function escalaBonita(maximo: number, marcas = 4): { maximo: number; paso: number } {
  if (!(maximo > 0)) return { maximo: 1, paso: 1 };
  const bruto = maximo / marcas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  // bruto / potencia está en [1, 10): el primer factor de 1, 2, 5 o 10 que lo cubra
  const factor = bruto / potencia;
  const paso = (factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10) * potencia;
  return { maximo: Math.ceil(maximo / paso) * paso, paso };
}
