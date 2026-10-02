import { describe, expect, it } from 'vitest';
import { cuotaAhorro } from '../../src/simulador/impuestos';
import { PARAMETROS_DEFECTO, simular, simularCuenta, simularFondo, type Parametros } from '../../src/simulador/simulacion';

const P = (cambios: Partial<Parametros>): Parametros => ({ ...PARAMETROS_DEFECTO, inflacion: 0, ter: 0, ...cambios });

// Valores conocidos de SPEC §7.4 (calculados a mano y en Node)
describe('escala del ahorro', () => {
  it('cuota_ahorro(10.000) = 1.980,00 €', () => expect(cuotaAhorro(10000)).toBe(1980));
  it('cuota_ahorro(9.671,51) = 1.911,02 €', () => expect(cuotaAhorro(9671.51)).toBe(1911.02));
  it('primer tramo y bases nulas o negativas', () => {
    expect(cuotaAhorro(250)).toBe(47.5);
    expect(cuotaAhorro(0)).toBe(0);
    expect(cuotaAhorro(-5)).toBe(0);
  });
  it('tramos altos: 400.000 € → 6.000·19 % + 44.000·21 % + 150.000·23 % + 100.000·27 % + 100.000·30 %', () => {
    expect(cuotaAhorro(400000)).toBe(1140 + 9240 + 34500 + 27000 + 30000);
  });
});

describe('cuenta remunerada', () => {
  it('100 €/mes al 2,5 % TAE durante 1 año, sin impuestos → 1.213,69 €', () => {
    expect(simularCuenta(P({ inicial: 0, mensual: 100, anios: 1, tae: 0.025 }), false).neto).toBe(1213.69);
  });

  it('10.000 € al 2,5 % durante 1 año: interés 250,00, cuota 47,50, neto 10.202,50 €', () => {
    const r = simularCuenta(P({ inicial: 10000, mensual: 0, anios: 1, tae: 0.025 }));
    expect(r.impuestos).toBe(47.5);
    expect(r.neto).toBe(10202.5);
    expect(r.serie.map((s) => s.anio)).toEqual([0, 1]);
  });
});

describe('fondo indexado', () => {
  it('10.000 € al 7 %, TER 0, 10 años → 19.671,51 €; cuota 1.911,02 €; neto 17.760,49 €', () => {
    const r = simularFondo(P({ inicial: 10000, mensual: 0, anios: 10 }), 0.07);
    expect(r.bruto).toBe(19671.51);
    expect(r.impuestos).toBe(1911.02);
    expect(r.neto).toBe(17760.49);
    expect(r.serie).toHaveLength(11);
  });

  it('el TER reduce el resultado y con pérdidas no hay impuesto', () => {
    const sinTer = simularFondo(P({ inicial: 10000, mensual: 0, anios: 10 }), 0.07).bruto;
    expect(simularFondo(P({ inicial: 10000, mensual: 0, anios: 10, ter: 0.005 }), 0.07).bruto).toBeLessThan(sinTer);
    expect(simularFondo(P({ inicial: 10000, mensual: 0, anios: 5 }), -0.05).impuestos).toBe(0);
  });

  it('valor real con inflación: neto / (1 + π)^años', () => {
    const r = simularFondo(P({ inicial: 10000, mensual: 0, anios: 10, inflacion: 0.02 }), 0.07);
    expect(r.netoReal).toBe(Math.round((17760.49 / 1.02 ** 10) * 100) / 100);
  });
});

describe('comparativa', () => {
  it('con los valores por defecto, el orden es pesimista < base < optimista', () => {
    const c = simular(PARAMETROS_DEFECTO);
    expect(c.pesimista.neto).toBeLessThan(c.base.neto);
    expect(c.base.neto).toBeLessThan(c.optimista.neto);
    expect(c.cuenta.aportado).toBe(c.base.aportado);
  });

  it('plazos con meses sueltos cierran en el último mes', () => {
    expect(simularFondo(P({ inicial: 0, mensual: 100, anios: 1.5 }), 0).serie.at(-1)).toEqual({ anio: 2, aportado: 1800, valor: 1800 });
  });
});
