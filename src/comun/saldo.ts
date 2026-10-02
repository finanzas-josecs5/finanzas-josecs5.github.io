import { centimos, type Centimos } from '../nucleo/dinero';
import { repartir, type Reparto } from './reparto';

// Saldo de un espacio compartido (SPEC §4.6, CA6.2, CA6.4). Funciones puras.
export interface MovimientoComun {
  importe: Centimos;
  sentido: 'entrada' | 'salida';
  pagado_por: string;
  reparto: Reparto | null;
}

export interface Liquidacion {
  de_user: string;
  a_user: string;
  importe: Centimos;
}

/**
 * Saldo de cada persona: positivo si le deben, negativo si debe. Siempre suma 0.
 * - Un gasto: quien paga adelanta el total y cada uno «consume» su parte.
 * - Un ingreso común (una devolución, por ejemplo): quien lo cobra se queda la parte de los demás.
 * - Una liquidación: quien paga reduce su deuda y quien cobra, su crédito.
 */
export function saldos(movimientos: readonly MovimientoComun[], liquidaciones: readonly Liquidacion[]): Map<string, Centimos> {
  const saldo = new Map<string, number>();
  const sumar = (usuario: string, cantidad: number) => saldo.set(usuario, (saldo.get(usuario) ?? 0) + cantidad);

  for (const m of movimientos) {
    if (!m.reparto) continue;
    const signo = m.sentido === 'salida' ? 1 : -1;
    sumar(m.pagado_por, signo * m.importe);
    for (const [usuario, parte] of repartir(m.importe, m.pagado_por, m.reparto)) sumar(usuario, -signo * parte);
  }
  for (const l of liquidaciones) {
    sumar(l.de_user, l.importe);
    sumar(l.a_user, 0 - l.importe);
  }
  return new Map([...saldo].map(([u, s]) => [u, centimos(s)]));
}

export type EstadoSaldo =
  | { tipo: 'en-paz' }
  | { tipo: 'te-deben'; importe: Centimos; deudor: string }
  | { tipo: 'debes'; importe: Centimos; acreedor: string };

/** El saldo visto por `yo` en un espacio de dos personas. */
export function estadoPara(yo: string, otro: string, saldo: ReadonlyMap<string, Centimos>): EstadoSaldo {
  const mio: number = saldo.get(yo) ?? 0;
  if (mio > 0) return { tipo: 'te-deben', importe: centimos(mio), deudor: otro };
  if (mio < 0) return { tipo: 'debes', importe: centimos(0 - mio), acreedor: otro };
  return { tipo: 'en-paz' };
}

/** Liquidación que deja el saldo a cero: quien debe le paga a quien le deben. */
export function liquidacionPendiente(yo: string, otro: string, saldo: ReadonlyMap<string, Centimos>): Liquidacion | null {
  const estado = estadoPara(yo, otro, saldo);
  if (estado.tipo === 'en-paz') return null;
  return estado.tipo === 'debes'
    ? { de_user: yo, a_user: otro, importe: estado.importe }
    : { de_user: otro, a_user: yo, importe: estado.importe };
}
