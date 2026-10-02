import { centimos, type Centimos } from '../nucleo/dinero';
import type { FechaISO } from '../nucleo/fechas';
import { xirr } from './xirr';

// Indicadores de un fondo y de la cartera (SPEC §4.8). Funciones puras.
export interface Aportacion {
  fecha: FechaISO;
  importe: Centimos;
}

export interface Valoracion {
  fecha: FechaISO;
  valor: Centimos;
}

export interface Indicadores {
  aportado: Centimos;
  valorActual: Centimos | null;
  fechaValor: FechaISO | null;
  plusvalia: Centimos | null;
  /** (valor − aportado) / aportado */
  rentabilidadSimple: number | null;
  /** TIR anualizada (XIRR): tiene en cuenta cuándo se aportó cada euro */
  tir: number | null;
  /** Coste anual estimado por el TER (informativo: ya está descontado del valor liquidativo) */
  costeAnualTer: Centimos | null;
}

export function ultimaValoracion(valoraciones: readonly Valoracion[]): Valoracion | null {
  return valoraciones.reduce<Valoracion | null>((ultima, v) => (!ultima || v.fecha > ultima.fecha ? v : ultima), null);
}

/**
 * Indicadores con las aportaciones hasta la fecha de la última valoración: las posteriores
 * aún no están reflejadas en ese valor y falsearían la plusvalía.
 */
export function indicadores(aportaciones: readonly Aportacion[], valoraciones: readonly Valoracion[], terPorcentaje: number): Indicadores {
  const ultima = ultimaValoracion(valoraciones);
  const incluidas = ultima ? aportaciones.filter((a) => a.fecha <= ultima.fecha) : aportaciones;
  const aportadoTotal = centimos(aportaciones.reduce((t, a) => t + a.importe, 0));
  if (!ultima) {
    return { aportado: aportadoTotal, valorActual: null, fechaValor: null, plusvalia: null, rentabilidadSimple: null, tir: null, costeAnualTer: null };
  }
  const aportadoHastaValor = incluidas.reduce((t, a) => t + a.importe, 0);
  const plusvalia = centimos(ultima.valor - aportadoHastaValor);
  return {
    aportado: aportadoTotal,
    valorActual: ultima.valor,
    fechaValor: ultima.fecha,
    plusvalia,
    rentabilidadSimple: aportadoHastaValor > 0 ? plusvalia / aportadoHastaValor : null,
    tir: xirr([...incluidas.map((a) => ({ fecha: a.fecha, importe: 0 - a.importe })), { fecha: ultima.fecha, importe: ultima.valor }]),
    costeAnualTer: centimos(Math.round((ultima.valor * terPorcentaje) / 100)),
  };
}

/** Serie para el gráfico: en cada valoración, el valor y lo aportado acumulado hasta ese día. */
export function evolucion(aportaciones: readonly Aportacion[], valoraciones: readonly Valoracion[]): { fecha: FechaISO; aportado: Centimos; valor: Centimos }[] {
  return [...valoraciones]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((v) => ({
      fecha: v.fecha,
      aportado: centimos(aportaciones.filter((a) => a.fecha <= v.fecha).reduce((t, a) => t + a.importe, 0)),
      valor: v.valor,
    }));
}
