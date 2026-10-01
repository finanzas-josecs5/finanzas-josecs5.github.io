import { centimos, type Centimos } from '../nucleo/dinero';
import { normalizarComercio } from '../nucleo/normalizar';
import type { MovimientoBasico } from './calculos';
import { prorrateoMensual, type ConfigNomina } from './nomina';

// Resumen del mes (SPEC §4.4, CA3.2, CA7.1). Función pura.
export type Vista = 'caja' | 'prorrateada';

export interface CategoriaBasica {
  id: string;
  nombre: string;
  sentido: 'entrada' | 'salida';
}

export interface LineaCategoria {
  categoriaId: string;
  nombre: string;
  importe: Centimos;
  /** Fracción del total de su sentido (0–1) */
  peso: number;
}

export interface Resumen {
  entradas: Centimos;
  salidas: Centimos;
  salidasFijas: Centimos;
  salidasVariables: Centimos;
  disponible: Centimos;
  entradasPorCategoria: LineaCategoria[];
  salidasPorCategoria: LineaCategoria[];
  /** En la vista prorrateada: lo apuntado como «Nómina» que se ha sustituido por el mensual equivalente */
  nominaSustituida: { apuntada: Centimos; prorrateada: Centimos } | null;
}

/** La categoría de ingresos «Nómina» (sembrada por defecto) es la que se prorratea. */
export function esCategoriaNomina(c: Pick<CategoriaBasica, 'nombre' | 'sentido'>): boolean {
  return c.sentido === 'entrada' && normalizarComercio(c.nombre) === 'nomina';
}

const NOMINA_PRORRATEADA = '__nomina_prorrateada__';

export function resumenDelMes(
  movimientos: readonly MovimientoBasico[],
  categorias: readonly CategoriaBasica[],
  opciones: { vista: Vista; nomina: ConfigNomina | null },
): Resumen {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const sumas = new Map<string, number>();
  let entradas = 0;
  let salidas = 0;
  let fijas = 0;
  let nominaApuntada = 0;
  const prorratear = opciones.vista === 'prorrateada' && opciones.nomina !== null;

  for (const m of movimientos) {
    const categoria = porId.get(m.categoria_id);
    if (m.sentido === 'entrada') {
      if (prorratear && categoria && esCategoriaNomina(categoria)) {
        nominaApuntada += m.importe;
        continue;
      }
      entradas += m.importe;
    } else {
      salidas += m.importe;
      if (m.naturaleza === 'fijo') fijas += m.importe;
    }
    sumas.set(m.categoria_id, (sumas.get(m.categoria_id) ?? 0) + m.importe);
  }

  let nominaSustituida: Resumen['nominaSustituida'] = null;
  if (prorratear && opciones.nomina) {
    const prorrateada = prorrateoMensual(opciones.nomina);
    entradas += prorrateada;
    sumas.set(NOMINA_PRORRATEADA, prorrateada);
    nominaSustituida = { apuntada: centimos(nominaApuntada), prorrateada };
  }

  const lineas = (sentido: 'entrada' | 'salida', total: number): LineaCategoria[] =>
    [...sumas.entries()]
      .filter(([id]) => (id === NOMINA_PRORRATEADA ? sentido === 'entrada' : porId.get(id)?.sentido === sentido))
      .map(([id, importe]) => ({
        categoriaId: id,
        nombre: id === NOMINA_PRORRATEADA ? 'Nómina (prorrateada)' : (porId.get(id)?.nombre ?? 'Sin categoría'),
        importe: centimos(importe),
        peso: total > 0 ? importe / total : 0,
      }))
      .sort((a, b) => b.importe - a.importe || a.nombre.localeCompare(b.nombre, 'es'));

  return {
    entradas: centimos(entradas),
    salidas: centimos(salidas),
    salidasFijas: centimos(fijas),
    salidasVariables: centimos(salidas - fijas),
    disponible: centimos(entradas - salidas),
    entradasPorCategoria: lineas('entrada', entradas),
    salidasPorCategoria: lineas('salida', salidas),
    nominaSustituida,
  };
}
