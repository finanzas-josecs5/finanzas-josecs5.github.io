import { describe, expect, it } from 'vitest';
import { aEuros, centimos, deEuros, parsearImporte, restar, sumar } from '../../src/nucleo/dinero';
import {
  claveMes,
  diasEntre,
  esFechaISO,
  fechaISO,
  hoy,
  mesesCompletosAnteriores,
  sumarMeses,
  ultimoDiaDelMes,
  type ClaveMes,
} from '../../src/nucleo/fechas';
import { formatearEUR, formatearEURConSigno, formatearPorcentaje } from '../../src/nucleo/formato';
import { normalizarComercio } from '../../src/nucleo/normalizar';

const NBSP = ' ';

describe('dinero', () => {
  it('opera con enteros y rechaza céntimos no enteros', () => {
    expect(sumar(centimos(150), centimos(250), centimos(-100))).toBe(300);
    expect(restar(centimos(1000), centimos(1))).toBe(999);
    expect(() => centimos(1.5)).toThrow(RangeError);
  });

  it('convierte euros a céntimos redondeando (evita 0,1 + 0,2)', () => {
    expect(deEuros(0.1 + 0.2)).toBe(30);
    expect(deEuros(19671.5136)).toBe(1967151);
    expect(aEuros(centimos(1234))).toBe(12.34);
  });
});

describe('parsearImporte (CA4.5)', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234.56', 123456],
    ['1,234.56', 123456],
    ['12', 1200],
    ['12,5', 1250],
    ['0,05', 5],
    ['1.234', 123400],
    ['1.234.567,89', 123456789],
    [' 12,10 € ', 1210],
    [`1.234,56${NBSP}€`, 123456],
    ['-3,20', -320],
    [',5', 50],
  ])('«%s» → %i céntimos', (texto, esperado) => {
    expect(parsearImporte(texto)).toEqual({ ok: true, importe: esperado });
  });

  it('marca como ambiguo «1,234» (¿mil doscientos o 1,234?)', () => {
    expect(parsearImporte('1,234')).toEqual({ ok: false, motivo: 'ambiguo' });
  });

  it.each(['abc', '12,345,6', '1.23.4', '12,3,4', '1.2345', '--5', '.', '1,2,3', '1.234,5,6', '12.34.567,8'])(
    'rechaza «%s»',
    (texto) => {
      expect(parsearImporte(texto)).toMatchObject({ ok: false, motivo: 'invalido' });
    },
  );

  it('vacío', () => {
    expect(parsearImporte('  ')).toEqual({ ok: false, motivo: 'vacio' });
  });

  it('rechaza importes fuera de rango seguro', () => {
    expect(parsearImporte('999999999999999999')).toMatchObject({ ok: false });
  });
});

describe('formato es-ES (SPEC §4.1)', () => {
  it('agrupa miles también con 4 cifras', () => {
    expect(formatearEUR(centimos(123456))).toBe(`1.234,56${NBSP}€`);
    expect(formatearEUR(centimos(-50))).toBe(`-0,50${NBSP}€`);
    expect(formatearEUR(centimos(123456789))).toBe(`1.234.567,89${NBSP}€`);
    expect(formatearEUR(centimos(0))).toBe(`0,00${NBSP}€`);
  });

  it('con signo explícito', () => {
    expect(formatearEURConSigno(centimos(1200))).toBe(`+12,00${NBSP}€`);
    expect(formatearEURConSigno(centimos(-1200))).toBe(`−12,00${NBSP}€`);
    expect(formatearEURConSigno(centimos(0))).toBe(`0,00${NBSP}€`);
  });

  it('porcentajes', () => {
    expect(formatearPorcentaje(0.025)).toBe(`2,5${NBSP}%`);
    expect(formatearPorcentaje(0.1)).toBe(`10${NBSP}%`);
  });
});

describe('normalizarComercio (CA4.2)', () => {
  it('«  MERCADONA, S.A. » y «Mercadona SA» dan la misma clave', () => {
    expect(normalizarComercio('  MERCADONA, S.A. ')).toBe('mercadona');
    expect(normalizarComercio('Mercadona SA')).toBe('mercadona');
  });

  it('quita tildes, signos y espacios repetidos', () => {
    expect(normalizarComercio('Cafetería  El Pilar, S.L.U.')).toBe('cafeteria el pilar');
    expect(normalizarComercio('LIDL Supermercados S.A.U.')).toBe('lidl supermercados');
  });

  it('no deja vacío un nombre que solo es una forma jurídica', () => {
    expect(normalizarComercio('S.A.')).toBe('sa');
    expect(normalizarComercio('   ')).toBe('');
  });
});

describe('fechas', () => {
  it('construye y valida fechas de calendario', () => {
    expect(fechaISO(2026, 9, 5)).toBe('2026-09-05');
    expect(() => fechaISO(2026, 2, 30)).toThrow(RangeError);
    expect(esFechaISO('2024-02-29')).toBe(true);
    expect(esFechaISO('2025-02-29')).toBe(false);
    expect(esFechaISO('05/09/2026')).toBe(false);
  });

  it('hoy usa la fecha local', () => {
    expect(hoy(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01');
  });

  it('meses', () => {
    expect(claveMes(fechaISO(2026, 9, 30))).toBe('2026-09');
    expect(sumarMeses('2026-01' as ClaveMes, -1)).toBe('2025-12');
    expect(sumarMeses('2026-11' as ClaveMes, 3)).toBe('2027-02');
    expect(mesesCompletosAnteriores(fechaISO(2026, 10, 1), 3)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(ultimoDiaDelMes('2024-02' as ClaveMes)).toBe(29);
    expect(ultimoDiaDelMes('2026-02' as ClaveMes)).toBe(28);
  });

  it('días entre fechas, también cruzando el cambio de hora', () => {
    expect(diasEntre(fechaISO(2026, 3, 28), fechaISO(2026, 3, 30))).toBe(2);
    expect(diasEntre(fechaISO(2025, 1, 1), fechaISO(2026, 1, 1))).toBe(365);
  });
});
