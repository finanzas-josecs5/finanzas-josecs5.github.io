import { centimos, type Centimos } from '../nucleo/dinero';
import type { ClaveMes } from '../nucleo/fechas';

// Nómina neta con 12 o 14 pagas (SPEC §4.2, F3). Funciones puras.
export interface ConfigNomina {
  pagas: 12 | 14;
  neto_ordinario: Centimos;
  neto_extra: Centimos;
  meses_extra: number[];
}

/** Mensual equivalente: (12 × ordinario + 2 × extra) / 12, redondeado al céntimo (CA3.1). */
export function prorrateoMensual(n: Pick<ConfigNomina, 'pagas' | 'neto_ordinario' | 'neto_extra'>): Centimos {
  if (n.pagas === 12) return n.neto_ordinario;
  return centimos(Math.round((12 * n.neto_ordinario + 2 * n.neto_extra) / 12));
}

/** Lo que se cobra de verdad un mes (caja real): en los meses de paga extra, ordinario + extra. */
export function cobroDelMes(n: ConfigNomina, mes: ClaveMes): Centimos {
  const numeroMes = Number(mes.slice(5, 7));
  const extra = n.pagas === 14 && n.meses_extra.includes(numeroMes) ? n.neto_extra : 0;
  return centimos(n.neto_ordinario + extra);
}

/** Neto anual: 12 o 14 pagas. */
export function netoAnual(n: ConfigNomina): Centimos {
  return centimos(12 * n.neto_ordinario + (n.pagas === 14 ? 2 * n.neto_extra : 0));
}
