// Inflación automática (SPEC §4.9.1, F10): descarga en el build la serie IPC290750 del INE
// («Nacional. Índice general. Variación anual», base 2025) y escribe public/datos/ipc.json.
// El navegador nunca contacta con el INE: lee el JSON del propio sitio (la CSP no cambia).
// Si la API falla o el dato no es válido, se usa el respaldo del repositorio y el build sigue.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SERIE = 'IPC290750';
export const URL_INE = `https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/${SERIE}?nult=130&tip=AM`;

export interface DatosIpc {
  serie: string;
  ultimo: { periodo: string; valor: number; tipo: string };
  media10: { desde: number; hasta: number; valor: number } | null;
  obtenido: string;
  fuente: 'INE';
  respaldo?: boolean;
}

interface Dato {
  Anyo?: unknown;
  T3_Periodo?: unknown;
  Valor?: unknown;
  T3_TipoDato?: unknown;
}

const esValorPlausible = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -10 && v <= 30;

/** Convierte la respuesta del INE en datos validados; lanza un error si algo no cuadra. */
export function procesarRespuestaIne(respuesta: unknown, ahora: Date): DatosIpc {
  const datos = (respuesta as { COD?: unknown; Data?: unknown } | null)?.Data;
  if ((respuesta as { COD?: unknown } | null)?.COD !== SERIE || !Array.isArray(datos) || datos.length === 0) {
    throw new Error('Respuesta del INE sin la serie esperada');
  }
  const validos = (datos as Dato[])
    .map((d) => ({
      anio: Number(d.Anyo),
      mes: Number((typeof d.T3_Periodo === 'string' ? d.T3_Periodo : '').replace(/^M/, '')),
      valor: d.Valor,
      tipo: typeof d.T3_TipoDato === 'string' ? d.T3_TipoDato : '',
    }))
    .filter((d) => Number.isInteger(d.anio) && d.mes >= 1 && d.mes <= 12 && esValorPlausible(d.valor))
    .sort((a, b) => a.anio * 12 + a.mes - (b.anio * 12 + b.mes));
  const ultimo = validos.at(-1);
  if (!ultimo || !esValorPlausible(ultimo.valor)) throw new Error('El INE no devuelve ningún dato válido');

  // Media geométrica de los IPC de diciembre de los últimos 10 años completos
  const diciembres = validos.filter((d) => d.mes === 12 && d.anio < ahora.getUTCFullYear()).slice(-10);
  let media10: DatosIpc['media10'] = null;
  if (diciembres.length === 10) {
    const producto = diciembres.reduce((p, d) => p * (1 + Number(d.valor) / 100), 1);
    media10 = {
      desde: diciembres[0]?.anio ?? 0,
      hasta: diciembres.at(-1)?.anio ?? 0,
      valor: Math.round(((producto ** (1 / 10) - 1) * 100) * 100) / 100,
    };
  }
  return {
    serie: SERIE,
    ultimo: { periodo: `${ultimo.anio}-${String(ultimo.mes).padStart(2, '0')}`, valor: ultimo.valor, tipo: ultimo.tipo || 'Definitivo' },
    media10,
    obtenido: ahora.toISOString(),
    fuente: 'INE',
  };
}

async function principal() {
  const destino = 'public/datos/ipc.json';
  let resultado: DatosIpc;
  try {
    const respuesta = await fetch(URL_INE, { signal: AbortSignal.timeout(15_000) });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    resultado = procesarRespuestaIne(await respuesta.json(), new Date());
    console.log(`obtener-ipc: ${resultado.ultimo.periodo} = ${resultado.ultimo.valor} % (${resultado.ultimo.tipo})`);
  } catch (error) {
    const respaldo = JSON.parse(readFileSync('src/simulador/ipc-respaldo.json', 'utf8')) as DatosIpc;
    resultado = { ...respaldo, respaldo: true };
    console.warn(`::warning::obtener-ipc: se usa el respaldo (${error instanceof Error ? error.message : String(error)})`);
  }
  mkdirSync('public/datos', { recursive: true });
  writeFileSync(destino, `${JSON.stringify(resultado, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await principal();
