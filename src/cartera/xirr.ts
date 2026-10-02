import { diasEntre, type FechaISO } from '../nucleo/fechas';

// TIR anualizada con fechas irregulares (XIRR, SPEC §4.8, CA8.2), base 365 días.
// Flujos: negativos lo que sale de tu bolsillo (aportaciones), positivo el valor actual.
export interface Flujo {
  fecha: FechaISO;
  importe: number;
}

function vpn(flujos: readonly Flujo[], tasa: number, inicio: FechaISO): number {
  return flujos.reduce((total, f) => total + f.importe / (1 + tasa) ** (diasEntre(inicio, f.fecha) / 365), 0);
}

function derivada(flujos: readonly Flujo[], tasa: number, inicio: FechaISO): number {
  return flujos.reduce((total, f) => {
    const t = diasEntre(inicio, f.fecha) / 365;
    return total - (t * f.importe) / (1 + tasa) ** (t + 1);
  }, 0);
}

/** Devuelve la tasa anual (0,1 = 10 %) o null si no tiene solución (p. ej. todos los flujos del mismo signo). */
export function xirr(flujos: readonly Flujo[]): number | null {
  if (!flujos.some((f) => f.importe < 0) || !flujos.some((f) => f.importe > 0)) return null;
  const ordenados = [...flujos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const inicio = ordenados[0]?.fecha;
  if (!inicio || inicio === ordenados.at(-1)?.fecha) return null;

  // Newton desde el 10 %…
  let tasa = 0.1;
  for (let i = 0; i < 50; i += 1) {
    const valor = vpn(ordenados, tasa, inicio);
    const pendiente = derivada(ordenados, tasa, inicio);
    if (!Number.isFinite(valor) || !Number.isFinite(pendiente) || pendiente === 0) break;
    const siguiente = tasa - valor / pendiente;
    if (siguiente <= -0.999999) break;
    if (Math.abs(siguiente - tasa) < 1e-10) return siguiente;
    tasa = siguiente;
  }

  // …y bisección si Newton no converge
  let bajo = -0.999;
  let alto = 10;
  let vBajo = vpn(ordenados, bajo, inicio);
  if (vBajo * vpn(ordenados, alto, inicio) > 0) return null;
  for (let i = 0; i < 300; i += 1) {
    const medio = (bajo + alto) / 2;
    const vMedio = vpn(ordenados, medio, inicio);
    if (Math.abs(vMedio) < 1e-7 || alto - bajo < 1e-12) return medio;
    if (vBajo * vMedio < 0) alto = medio;
    else {
      bajo = medio;
      vBajo = vMedio;
    }
  }
  return (bajo + alto) / 2;
}
