import { describe, expect, it } from 'vitest';
import { agruparPorDia, filtrar, importeConSigno, totales, type MovimientoBasico } from '../../src/movimientos/calculos';
import { centimos, textoEditable } from '../../src/nucleo/dinero';
import type { ClaveMes, FechaISO } from '../../src/nucleo/fechas';
import { nombreDia, nombreMes } from '../../src/nucleo/textos';

const mov = (
  fecha: string,
  importe: number,
  sentido: 'entrada' | 'salida',
  categoria_id = 'c1',
  naturaleza: 'fijo' | 'variable' = 'variable',
): MovimientoBasico => ({ fecha: fecha as FechaISO, importe: centimos(importe), sentido, categoria_id, naturaleza });

const MES = [
  mov('2026-09-30', 250000, 'entrada', 'nomina', 'fijo'),
  mov('2026-09-30', 2345, 'salida', 'super'),
  mov('2026-09-12', 80000, 'salida', 'vivienda', 'fijo'),
  mov('2026-09-05', 1210, 'salida', 'super'),
];

describe('cálculos de la lista de movimientos', () => {
  it('totales del mes', () => {
    expect(totales(MES)).toEqual({ entradas: 250000, salidas: 83555, balance: 166445 });
    expect(totales([])).toEqual({ entradas: 0, salidas: 0, balance: 0 });
  });

  it('importe con signo', () => {
    expect(importeConSigno(MES[0]!)).toBe(250000);
    expect(importeConSigno(MES[1]!)).toBe(-2345);
  });

  it('agrupa por día conservando el orden y con el neto de cada día', () => {
    const grupos = agruparPorDia(MES);
    expect(grupos.map((g) => [g.fecha, g.movimientos.length, g.neto])).toEqual([
      ['2026-09-30', 2, 247655],
      ['2026-09-12', 1, -80000],
      ['2026-09-05', 1, -1210],
    ]);
  });

  it('filtra por categoría y por fijo/variable', () => {
    expect(filtrar(MES, { categoriaId: 'super', naturaleza: null })).toHaveLength(2);
    expect(filtrar(MES, { categoriaId: null, naturaleza: 'fijo' })).toHaveLength(2);
    expect(filtrar(MES, { categoriaId: 'super', naturaleza: 'fijo' })).toHaveLength(0);
    expect(filtrar(MES, { categoriaId: null, naturaleza: null })).toHaveLength(4);
  });
});

describe('textos', () => {
  it('importe editable sin puntos de miles', () => {
    expect(textoEditable(centimos(123456))).toBe('1234,56');
    expect(textoEditable(centimos(5))).toBe('0,05');
    expect(textoEditable(centimos(-1210))).toBe('-12,10');
  });

  it('nombres de mes y día en español', () => {
    expect(nombreMes('2026-09' as ClaveMes)).toBe('Septiembre de 2026');
    expect(nombreDia('2026-09-05' as FechaISO)).toBe('Sábado, 5 de septiembre');
  });
});
