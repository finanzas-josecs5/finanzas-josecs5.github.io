import escala from './escala-ahorro.json';

// Escala de la base liquidable del ahorro (SPEC §7.4) [por verificar en el BOE y la AEAT].
// Importes en euros (el simulador trabaja con float y redondea al céntimo al mostrar).
export interface Tramo {
  hasta: number | null;
  tipo: number;
}

export const ESCALA_AHORRO: readonly Tramo[] = escala.tramos;
export const FUENTE_ESCALA = escala.fuente;

/** Cuota íntegra del ahorro para una base en euros, redondeada al céntimo. */
export function cuotaAhorro(base: number, tramos: readonly Tramo[] = ESCALA_AHORRO): number {
  if (!(base > 0)) return 0;
  let cuota = 0;
  let desde = 0;
  for (const { hasta, tipo } of tramos) {
    const tope = hasta ?? Number.POSITIVE_INFINITY;
    if (base <= desde) break;
    cuota += (Math.min(base, tope) - desde) * tipo;
    desde = tope;
  }
  return Math.round(cuota * 100) / 100;
}
