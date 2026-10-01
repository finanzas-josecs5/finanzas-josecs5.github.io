import { describe, expect, it } from 'vitest';
import type { MovimientoBasico } from '../../src/movimientos/calculos';
import { cobroDelMes, netoAnual, prorrateoMensual, type ConfigNomina } from '../../src/movimientos/nomina';
import { esCategoriaNomina, resumenDelMes, type CategoriaBasica } from '../../src/movimientos/resumen';
import { centimos } from '../../src/nucleo/dinero';
import type { ClaveMes, FechaISO } from '../../src/nucleo/fechas';

const c = centimos;
const NOMINA_14: ConfigNomina = { pagas: 14, neto_ordinario: c(200000), neto_extra: c(200000), meses_extra: [6, 12] };

describe('nómina (CA3.1)', () => {
  it('14 pagas de 2.000 € → 2.333,33 €/mes prorrateado', () => {
    expect(prorrateoMensual(NOMINA_14)).toBe(233333);
  });

  it('con 12 pagas el mensual es el neto ordinario', () => {
    expect(prorrateoMensual({ pagas: 12, neto_ordinario: c(250000), neto_extra: c(0) })).toBe(250000);
  });

  it('extra distinta de la ordinaria', () => {
    expect(prorrateoMensual({ pagas: 14, neto_ordinario: c(180000), neto_extra: c(150000) })).toBe(205000);
  });

  it('caja real: en junio y diciembre entra la extra', () => {
    expect(cobroDelMes(NOMINA_14, '2026-06' as ClaveMes)).toBe(400000);
    expect(cobroDelMes(NOMINA_14, '2026-12' as ClaveMes)).toBe(400000);
    expect(cobroDelMes(NOMINA_14, '2026-09' as ClaveMes)).toBe(200000);
    expect(cobroDelMes({ ...NOMINA_14, pagas: 12 }, '2026-06' as ClaveMes)).toBe(200000);
  });

  it('neto anual', () => {
    expect(netoAnual(NOMINA_14)).toBe(2800000);
    expect(netoAnual({ ...NOMINA_14, pagas: 12 })).toBe(2400000);
  });
});

const CATEGORIAS: CategoriaBasica[] = [
  { id: 'nom', nombre: 'Nómina', sentido: 'entrada' },
  { id: 'otros-in', nombre: 'Otros ingresos', sentido: 'entrada' },
  { id: 'viv', nombre: 'Vivienda', sentido: 'salida' },
  { id: 'sup', nombre: 'Supermercado', sentido: 'salida' },
];

const mov = (importe: number, sentido: 'entrada' | 'salida', categoria_id: string, naturaleza: 'fijo' | 'variable' = 'variable'): MovimientoBasico => ({
  fecha: '2026-06-15' as FechaISO,
  importe: c(importe),
  sentido,
  categoria_id,
  naturaleza,
});

// Junio: nómina ordinaria + paga extra apuntadas, un ingreso extra, alquiler fijo y súper
const JUNIO = [
  mov(200000, 'entrada', 'nom', 'fijo'),
  mov(200000, 'entrada', 'nom', 'fijo'),
  mov(5000, 'entrada', 'otros-in'),
  mov(80000, 'salida', 'viv', 'fijo'),
  mov(30000, 'salida', 'sup'),
  mov(10000, 'salida', 'sup'),
];

describe('resumen del mes (CA7.1, CA3.2)', () => {
  it('caja real: lo apuntado, con la extra de junio incluida', () => {
    const r = resumenDelMes(JUNIO, CATEGORIAS, { vista: 'caja', nomina: NOMINA_14 });
    expect(r.entradas).toBe(405000);
    expect(r.salidas).toBe(120000);
    expect(r.salidasFijas).toBe(80000);
    expect(r.salidasVariables).toBe(40000);
    expect(r.disponible).toBe(285000);
    expect(r.nominaSustituida).toBeNull();
    expect(r.salidasPorCategoria.map((l) => [l.nombre, l.importe])).toEqual([
      ['Vivienda', 80000],
      ['Supermercado', 40000],
    ]);
    expect(r.salidasPorCategoria[0]?.peso).toBeCloseTo(2 / 3);
  });

  it('prorrateada: la nómina apuntada se sustituye por el mensual equivalente (sin la extra)', () => {
    const r = resumenDelMes(JUNIO, CATEGORIAS, { vista: 'prorrateada', nomina: NOMINA_14 });
    expect(r.entradas).toBe(238333);
    expect(r.disponible).toBe(118333);
    expect(r.nominaSustituida).toEqual({ apuntada: 400000, prorrateada: 233333 });
    expect(r.entradasPorCategoria.map((l) => [l.nombre, l.importe])).toEqual([
      ['Nómina (prorrateada)', 233333],
      ['Otros ingresos', 5000],
    ]);
  });

  it('prorrateada sin nómina configurada equivale a caja real', () => {
    const r = resumenDelMes(JUNIO, CATEGORIAS, { vista: 'prorrateada', nomina: null });
    expect(r.entradas).toBe(405000);
    expect(r.nominaSustituida).toBeNull();
  });

  it('mes vacío', () => {
    const r = resumenDelMes([], CATEGORIAS, { vista: 'caja', nomina: null });
    expect(r).toMatchObject({ entradas: 0, salidas: 0, disponible: 0, salidasPorCategoria: [] });
  });

  it('reconoce la categoría «Nómina» aunque cambie mayúsculas o tildes', () => {
    expect(esCategoriaNomina({ nombre: 'NOMINA', sentido: 'entrada' })).toBe(true);
    expect(esCategoriaNomina({ nombre: 'Nómina', sentido: 'salida' })).toBe(false);
    expect(esCategoriaNomina({ nombre: 'Otros ingresos', sentido: 'entrada' })).toBe(false);
  });
});
