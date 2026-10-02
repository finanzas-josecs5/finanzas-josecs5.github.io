import { parsearImporte, type Centimos } from '../nucleo/dinero';
import { fechaISO, type FechaISO } from '../nucleo/fechas';

// Datos de un ticket a partir del texto del OCR (SPEC §4.5, CA5.1–CA5.4). Función pura:
// la app siempre enseña la propuesta para revisarla; nunca se guarda sola.
export type Confianza = 'alta' | 'media' | 'baja';

export interface DatosTicket {
  importe: Centimos | null;
  fecha: FechaISO | null;
  comercio: string | null;
  confianza: Confianza;
}

// Importes con dos decimales al estilo español (12,10 · 1.234,56) y, por si el OCR lee
// puntos, también 12.10. No se aceptan enteros sueltos: en un ticket suelen ser cantidades.
const IMPORTE = /\d{1,3}(?:[.\s]\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2}(?!\d)/g;

const PALABRA_TOTAL = /\b(?:TOTAL|IMPORTE|A\s+PAGAR)\b/;
// El OCR confunde a menudo la O con un cero: «T0TAL»
const PALABRA_TOTAL_DUDOSA = /\bT[O0]T[A4]L\b/;
// Líneas con importes que NO son el total
const NO_ES_TOTAL = /SUB\s*-?\s*TOTAL|\bIVA\b|\bBASE\b|CAMBIO|ENTREGAD|EFECTIVO|DEVOLUCI|ART[IÍ]CULOS|UNIDADES|DESCUENTO|AHORRO/;
const DESCARTAR_EN_RESPALDO = /CAMBIO|ENTREGAD|EFECTIVO|DEVOLUCI/;

function importesDe(linea: string): Centimos[] {
  const resultado: Centimos[] = [];
  for (const m of linea.matchAll(IMPORTE)) {
    const r = parsearImporte(m[0].replace(/\s/g, ''));
    if (r.ok && r.importe > 0) resultado.push(r.importe);
  }
  return resultado;
}

function buscarImporte(lineas: readonly string[]): { importe: Centimos | null; confianza: Confianza } {
  const mayusculas = lineas.map((l) => l.toUpperCase());

  for (const [patron, confianza] of [
    [PALABRA_TOTAL, 'alta'],
    [PALABRA_TOTAL_DUDOSA, 'media'],
  ] as const) {
    const candidatos = mayusculas
      .filter((l) => patron.test(l) && !NO_ES_TOTAL.test(l))
      .map((l) => importesDe(l).at(-1))
      .filter((i): i is Centimos => i !== undefined);
    // Si hay varias líneas de total (total y «total EUR»), la mayor es el total del ticket
    if (candidatos.length > 0) return { importe: Math.max(...candidatos) as Centimos, confianza };
  }

  // Sin línea de total: el importe mayor, con confianza baja (siempre se revisa)
  const todos = mayusculas.filter((l) => !DESCARTAR_EN_RESPALDO.test(l)).flatMap(importesDe);
  return { importe: todos.length > 0 ? (Math.max(...todos) as Centimos) : null, confianza: 'baja' };
}

const FECHA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g;

function buscarFecha(texto: string): FechaISO | null {
  for (const m of texto.matchAll(FECHA)) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const anio = (m[3] ?? '').length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    try {
      return fechaISO(anio, mes, dia);
    } catch {
      // Fecha imposible (31/02): se sigue buscando
    }
  }
  return null;
}

// Líneas de cabecera que no son el nombre del comercio
// («C/» va fuera del grupo: entre «/» y un espacio no hay límite de palabra \b)
const NO_ES_COMERCIO = /\b(?:NIF|CIF|N\.?I\.?F|CALLE|AVDA|AVENIDA|PLAZA|TEL[EÉ]?F?|TLF|FECHA|TICKET|FACTURA|SIMPLIFICADA|WWW|HTTP|CP)\b|\bC\/|@|\d{5}/;

function buscarComercio(lineas: readonly string[]): string | null {
  for (const linea of lineas.slice(0, 6)) {
    const limpia = linea.replace(/\s+/g, ' ').trim();
    const letras = limpia.match(/\p{L}/gu)?.length ?? 0;
    if (letras < 3 || NO_ES_COMERCIO.test(limpia.toUpperCase()) || importesDe(limpia).length > 0) continue;
    return limpia.replace(/[\s.,;:*-]+$/, '').slice(0, 80);
  }
  return null;
}

export function extraer(texto: string): DatosTicket {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const { importe, confianza } = buscarImporte(lineas);
  return { importe, fecha: buscarFecha(texto), comercio: buscarComercio(lineas), confianza };
}
