import { describe, expect, it } from 'vitest';
import type { MovimientoBasico } from '../../src/movimientos/calculos';
import { escalaBonita, mediaDeMeses, serieMensual } from '../../src/movimientos/historico';
import { centimos } from '../../src/nucleo/dinero';
import { mesesCompletosAnteriores, type ClaveMes, type FechaISO } from '../../src/nucleo/fechas';

const mov = (fecha: string, importe: number, sentido: 'entrada' | 'salida'): MovimientoBasico => ({
  fecha: fecha as FechaISO,
  importe: centimos(importe),
  sentido,
  categoria_id: 'c',
  naturaleza: 'variable',
});

const MESES = ['2026-07', '2026-08', '2026-09', '2026-10'] as ClaveMes[];
const MOVS = [
  mov('2026-07-01', 200000, 'entrada'),
  mov('2026-07-15', 150000, 'salida'),
  mov('2026-08-01', 200000, 'entrada'),
  mov('2026-08-20', 90000, 'salida'),
  mov('2026-09-01', 230000, 'entrada'),
  mov('2026-09-03', 120000, 'salida'),
  mov('2026-10-01', 200000, 'entrada'), // mes en curso
  mov('2026-05-10', 999999, 'salida'), // fuera del rango pedido
];

describe('histórico (CA7.2)', () => {
  it('serie mensual con los meses pedidos, también los vacíos', () => {
    expect(serieMensual(MOVS, [...MESES, '2026-11' as ClaveMes])).toEqual([
      { mes: '2026-07', entradas: 200000, salidas: 150000, balance: 50000 },
      { mes: '2026-08', entradas: 200000, salidas: 90000, balance: 110000 },
      { mes: '2026-09', entradas: 230000, salidas: 120000, balance: 110000 },
      { mes: '2026-10', entradas: 200000, salidas: 0, balance: 200000 },
      { mes: '2026-11', entradas: 0, salidas: 0, balance: 0 },
    ]);
  });

  it('la media de 3 meses usa solo meses completos (no el mes en curso)', () => {
    const serie = serieMensual(MOVS, MESES);
    const completos = mesesCompletosAnteriores('2026-10-01' as FechaISO, 3);
    expect(completos).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(mediaDeMeses(serie, completos)).toEqual({ entradas: 210000, salidas: 120000, balance: 90000 });
  });

  it('media redondeada al céntimo y nula sin meses', () => {
    const serie = serieMensual([mov('2026-07-01', 100, 'salida')], MESES);
    expect(mediaDeMeses(serie, ['2026-07', '2026-08', '2026-09'] as ClaveMes[])?.salidas).toBe(33);
    expect(mediaDeMeses(serie, [])).toBeNull();
  });

  it('escala con valores redondos', () => {
    // 230.000 / 4 = 57.500 → primer paso redondo ≥ 57.500 es 100.000 → eje hasta 300.000
    expect(escalaBonita(230000)).toEqual({ maximo: 300000, paso: 100000 });
    // 95 / 4 = 23,75 → paso 50 → eje hasta 100
    expect(escalaBonita(95)).toEqual({ maximo: 100, paso: 50 });
    // 1.000 / 4 = 250 → paso 500 → eje hasta 1.000
    expect(escalaBonita(1000)).toEqual({ maximo: 1000, paso: 500 });
    // 7 / 4 = 1,75 → paso 2 → eje hasta 8
    expect(escalaBonita(7)).toEqual({ maximo: 8, paso: 2 });
    // 400 / 4 = 100 → paso exacto 100; 3.000 / 4 = 750 → paso 1.000
    expect(escalaBonita(400)).toEqual({ maximo: 400, paso: 100 });
    expect(escalaBonita(3000)).toEqual({ maximo: 3000, paso: 1000 });
    expect(escalaBonita(0)).toEqual({ maximo: 1, paso: 1 });
  });
});
