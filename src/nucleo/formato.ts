import type { Centimos } from './dinero';

// SPEC §4.1: sin useGrouping 'always', es-ES escribe «1234,56 €» (no agrupa números de 4 cifras).
const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  useGrouping: 'always',
});

const PORCENTAJE = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});

/** 123456 → «1.234,56 €» (con espacio de no separación U+00A0 antes de €). */
export function formatearEUR(importe: Centimos): string {
  return EUR.format(importe / 100);
}

/** Con signo explícito para entradas y salidas (SPEC §9: el color nunca va solo): «+12,00 €» / «−12,00 €». */
export function formatearEURConSigno(importe: Centimos): string {
  const base = EUR.format(Math.abs(importe) / 100);
  if (importe > 0) return `+${base}`;
  if (importe < 0) return `−${base}`;
  return base;
}

/** 0.025 → «2,5 %» */
export function formatearPorcentaje(fraccion: number): string {
  return PORCENTAJE.format(fraccion);
}
