import { parsearImporte, type Centimos } from '../nucleo/dinero';

// Valor de una posición a partir de la captura del banco o bróker (SPEC CA8.4). Función pura:
// se propone y la persona lo confirma antes de guardar.
const IMPORTE = /\d{1,3}(?:[.\s]\d{3})+,\d{2}|\d+,\d{2}/g;
const PALABRAS_VALOR = /VALOR|POSICI[OÓ]N|SALDO|PATRIMONIO|TOTAL|IMPORTE|VALORACI[OÓ]N/;
// Líneas que suelen tener importes que no son el valor
const NO_ES_VALOR = /RENTABILIDAD|PLUSVAL|GANANCIA|P[EÉ]RDIDA|COMISI[OÓ]N|APORTAD|INVERTID|COSTE|\bVL\b|LIQUIDATIVO|PARTICIPACI/;

function importesDe(linea: string): Centimos[] {
  const r: Centimos[] = [];
  for (const m of linea.matchAll(IMPORTE)) {
    const p = parsearImporte(m[0].replace(/\s/g, ''));
    if (p.ok && p.importe > 0) r.push(p.importe);
  }
  return r;
}

export function extraerValor(texto: string): { valor: Centimos | null; confianza: 'alta' | 'baja' } {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim().toUpperCase())
    .filter(Boolean);
  // Una palabra de valor en la línea, o en la anterior (las apps suelen poner la etiqueta encima)
  const candidatos: Centimos[] = [];
  lineas.forEach((linea, i) => {
    const etiqueta = PALABRAS_VALOR.test(linea) || PALABRAS_VALOR.test(lineas[i - 1] ?? '');
    const descartada = NO_ES_VALOR.test(linea) || NO_ES_VALOR.test(lineas[i - 1] ?? '');
    if (etiqueta && !descartada) candidatos.push(...importesDe(linea));
  });
  if (candidatos.length > 0) return { valor: Math.max(...candidatos) as Centimos, confianza: 'alta' };
  const todos = lineas.filter((l) => !NO_ES_VALOR.test(l)).flatMap(importesDe);
  return { valor: todos.length > 0 ? (Math.max(...todos) as Centimos) : null, confianza: 'baja' };
}
