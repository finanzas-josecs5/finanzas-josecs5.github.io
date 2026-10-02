import { describe, expect, it } from 'vitest';
import { evolucion, indicadores, ultimaValoracion } from '../../src/cartera/cartera';
import { esIsinValido, normalizarIsin } from '../../src/cartera/isin';
import { xirr } from '../../src/cartera/xirr';
import { centimos } from '../../src/nucleo/dinero';
import type { FechaISO } from '../../src/nucleo/fechas';

const f = (s: string) => s as FechaISO;
const c = centimos;

describe('ISIN (CA8.1)', () => {
  it('IE00B4L5Y983 es válido; con el último dígito alterado, no', () => {
    expect(esIsinValido('IE00B4L5Y983')).toBe(true);
    expect(esIsinValido('IE00B4L5Y984')).toBe(false);
  });

  it('otros ISIN reales de fondos indexados', () => {
    expect(esIsinValido('IE00B03HCZ61')).toBe(true); // Vanguard Global Stock Index
    expect(esIsinValido('LU0996182563')).toBe(true); // Amundi Index MSCI World
    expect(esIsinValido('US0378331005')).toBe(true); // Apple (referencia clásica)
  });

  it('acepta minúsculas y espacios al escribirlo, rechaza formatos imposibles', () => {
    expect(normalizarIsin(' ie00 b4l5 y983 ')).toBe('IE00B4L5Y983');
    expect(esIsinValido('ie00b4l5y983')).toBe(true);
    expect(esIsinValido('IE00B4L5Y98')).toBe(false);
    expect(esIsinValido('1E00B4L5Y983')).toBe(false);
    expect(esIsinValido('')).toBe(false);
  });
});

describe('XIRR (CA8.2)', () => {
  it('−1.000 € el 2025-01-01 y +1.100 € el 2026-01-01 → 10,00 %', () => {
    const tir = xirr([
      { fecha: f('2025-01-01'), importe: -1000 },
      { fecha: f('2026-01-01'), importe: 1100 },
    ]);
    expect(tir).toBeCloseTo(0.1, 6);
  });

  it('aportaciones periódicas: cuadra con el valor presente neto', () => {
    const flujos = [
      { fecha: f('2025-01-01'), importe: -1000 },
      { fecha: f('2025-07-01'), importe: -1000 },
      { fecha: f('2026-01-01'), importe: 2150 },
    ];
    const tir = xirr(flujos) ?? Number.NaN;
    const vpn = flujos.reduce((t, x) => t + x.importe / (1 + tir) ** (((Date.parse(x.fecha) - Date.parse('2025-01-01')) / 86400000) / 365), 0);
    expect(Math.abs(vpn)).toBeLessThan(1e-4);
    expect(tir).toBeGreaterThan(0.09);
    expect(tir).toBeLessThan(0.11);
  });

  it('pérdidas fuertes (la bisección encuentra la tasa)', () => {
    expect(xirr([{ fecha: f('2025-01-01'), importe: -1000 }, { fecha: f('2026-01-01'), importe: 100 }])).toBeCloseTo(-0.9, 4);
  });

  it('sin solución → null', () => {
    expect(xirr([{ fecha: f('2025-01-01'), importe: -1000 }])).toBeNull();
    expect(xirr([{ fecha: f('2025-01-01'), importe: 1000 }, { fecha: f('2026-01-01'), importe: 100 }])).toBeNull();
    expect(xirr([{ fecha: f('2025-01-01'), importe: -1000 }, { fecha: f('2025-01-01'), importe: 1100 }])).toBeNull();
  });
});

describe('indicadores de un fondo', () => {
  const aportaciones = [
    { fecha: f('2025-01-01'), importe: c(100000) },
    { fecha: f('2026-03-01'), importe: c(50000) }, // posterior a la última valoración
  ];
  const valoraciones = [
    { fecha: f('2025-06-30'), valor: c(103000) },
    { fecha: f('2026-01-01'), valor: c(110000) },
  ];

  it('aportado, valor, plusvalía, rentabilidad, TIR y coste del TER', () => {
    const r = indicadores(aportaciones, valoraciones, 0.2);
    expect(r).toMatchObject({ aportado: 150000, valorActual: 110000, fechaValor: '2026-01-01', plusvalia: 10000, costeAnualTer: 220 });
    expect(r.rentabilidadSimple).toBeCloseTo(0.1);
    expect(r.tir).toBeCloseTo(0.1, 6);
  });

  it('sin valoraciones solo se conoce lo aportado', () => {
    expect(indicadores(aportaciones, [], 0.2)).toEqual({
      aportado: 150000,
      valorActual: null,
      fechaValor: null,
      plusvalia: null,
      rentabilidadSimple: null,
      tir: null,
      costeAnualTer: null,
    });
  });

  it('última valoración y evolución para el gráfico', () => {
    expect(ultimaValoracion(valoraciones)?.fecha).toBe('2026-01-01');
    expect(ultimaValoracion([])).toBeNull();
    expect(evolucion(aportaciones, [...valoraciones].reverse())).toEqual([
      { fecha: '2025-06-30', aportado: 100000, valor: 103000 },
      { fecha: '2026-01-01', aportado: 100000, valor: 110000 },
    ]);
  });

  it('valoración sin aportaciones previas: sin rentabilidad', () => {
    expect(indicadores([], [{ fecha: f('2026-01-01'), valor: c(500) }], 0).rentabilidadSimple).toBeNull();
  });
});
