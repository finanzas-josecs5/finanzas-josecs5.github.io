// Todos los importes se guardan como enteros en céntimos (SPEC §4): nunca floats.
export type Centimos = number & { readonly __marca: 'Centimos' };

export function centimos(valor: number): Centimos {
  if (!Number.isSafeInteger(valor)) throw new RangeError(`Importe en céntimos no entero: ${valor}`);
  return valor as Centimos;
}

export const CERO = centimos(0);

export function sumar(...importes: Centimos[]): Centimos {
  return centimos(importes.reduce<number>((total, i) => total + i, 0));
}

export function restar(a: Centimos, b: Centimos): Centimos {
  return centimos(a - b);
}

/** Convierte euros (float, solo para cálculos del simulador) a céntimos redondeando al céntimo. */
export function deEuros(euros: number): Centimos {
  return centimos(Math.round(euros * 100));
}

export function aEuros(importe: Centimos): number {
  return importe / 100;
}

export type ResultadoImporte =
  | { ok: true; importe: Centimos }
  | { ok: false; motivo: 'vacio' | 'invalido' | 'ambiguo' };

/**
 * Interpreta lo que escribe el usuario (SPEC CA4.5): «1.234,56», «1234,56», «1234.56», «12», «12,5 €».
 * - Con punto y coma, el último separador es el decimal.
 * - Solo coma: decimal si lleva 1 o 2 cifras detrás; con 3 es ambiguo («1,234»).
 * - Solo punto: decimal con 1 o 2 cifras; con grupos de 3 («1.234», «1.234.567») son miles.
 */
export function parsearImporte(texto: string): ResultadoImporte {
  // \s ya incluye el espacio de no separación (U+00A0) que usa el formato es-ES
  const limpio = texto.replace(/[\s€]/g, '');
  if (limpio === '') return { ok: false, motivo: 'vacio' };

  const signo = limpio.startsWith('-') ? -1 : 1;
  const cuerpo = limpio.replace(/^[-+]/, '');
  if (!/^[\d.,]+$/.test(cuerpo) || !/\d/.test(cuerpo)) return { ok: false, motivo: 'invalido' };

  const tienePunto = cuerpo.includes('.');
  const tieneComa = cuerpo.includes(',');
  let entera: string;
  let decimales = '';

  if (tienePunto && tieneComa) {
    const sepDecimal = cuerpo.lastIndexOf('.') > cuerpo.lastIndexOf(',') ? '.' : ',';
    const sepMiles = sepDecimal === '.' ? ',' : '.';
    const partes = cuerpo.split(sepDecimal);
    const [miles = '', dec = ''] = partes;
    if (partes.length !== 2 || !esGrupoDeMiles(miles, sepMiles)) return { ok: false, motivo: 'invalido' };
    entera = miles.split(sepMiles).join('');
    decimales = dec;
  } else if (tienePunto || tieneComa) {
    const sep = tieneComa ? ',' : '.';
    const partes = cuerpo.split(sep);
    const ultima = partes.at(-1) ?? '';
    if (partes.length === 2 && ultima.length >= 1 && ultima.length <= 2) {
      entera = partes[0] ?? '';
      decimales = ultima;
    } else if (sep === '.' && esGrupoDeMiles(cuerpo, '.')) {
      entera = partes.join('');
    } else if (sep === ',' && partes.length === 2 && ultima.length === 3) {
      return { ok: false, motivo: 'ambiguo' };
    } else {
      return { ok: false, motivo: 'invalido' };
    }
  } else {
    entera = cuerpo;
  }

  if (!/^\d*$/.test(entera) || !/^\d{0,2}$/.test(decimales) || entera + decimales === '') {
    return { ok: false, motivo: 'invalido' };
  }
  const valor = Number(entera || '0') * 100 + Number(decimales.padEnd(2, '0'));
  if (!Number.isSafeInteger(valor)) return { ok: false, motivo: 'invalido' };
  return { ok: true, importe: centimos(signo * valor) };
}

/** «1.234.567» con sep «.» → true; «12.34» → false. Sin separador: solo cifras. */
function esGrupoDeMiles(texto: string, sep: string): boolean {
  const grupos = texto.split(sep);
  if (grupos.length === 1) return /^\d+$/.test(texto);
  const [primero = '', ...resto] = grupos;
  return /^\d{1,3}$/.test(primero) && resto.every((g) => /^\d{3}$/.test(g));
}
