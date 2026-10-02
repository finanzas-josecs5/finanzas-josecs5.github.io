import { describe, expect, it } from 'vitest';
import { parteDe, repartir, repartoConMiParte, repartoPorDefecto } from '../../src/comun/reparto';
import { centimos } from '../../src/nucleo/dinero';

const A = 'aaaa';
const B = 'bbbb';

describe('reparto de gastos compartidos', () => {
  it('CA6.1: 10,01 € al 50/50 pagado por A → B 5,00 y A 5,01', () => {
    const partes = repartir(centimos(1001), A, { [A]: 50, [B]: 50 });
    expect(partes.get(B)).toBe(500);
    expect(partes.get(A)).toBe(501);
  });

  it('CA6.7: 100 € al 70/30 → 70,00 y 30,00', () => {
    const partes = repartir(centimos(10000), A, { [A]: 70, [B]: 30 });
    expect([partes.get(A), partes.get(B)]).toEqual([7000, 3000]);
  });

  it('las partes siempre suman el importe', () => {
    for (const importe of [1, 3, 999, 1001, 33333, 123457]) {
      for (const pct of [0, 33.33, 50, 66.67, 100]) {
        const partes = repartir(centimos(importe), B, { [A]: pct, [B]: 100 - pct });
        expect([...partes.values()].reduce((t, p) => t + p, 0)).toBe(importe);
      }
    }
  });

  it('si quien paga no participa, solo asume el redondeo', () => {
    const partes = repartir(centimos(1000), A, { [B]: 100 });
    expect([partes.get(A), partes.get(B)]).toEqual([0, 1000]);
  });

  it('parte de cada uno', () => {
    expect(parteDe(A, centimos(1001), A, { [A]: 50, [B]: 50 })).toBe(501);
    expect(parteDe('otro', centimos(1001), A, { [A]: 50, [B]: 50 })).toBe(0);
  });

  it('mi parte y el resto para el otro', () => {
    expect(repartoConMiParte(A, B, 70)).toEqual({ [A]: 70, [B]: 30 });
    expect(repartoConMiParte(A, B, 33.333)).toEqual({ [A]: 33.33, [B]: 66.67 });
    expect(repartoConMiParte(A, B, 120)).toEqual({ [A]: 100, [B]: 0 });
    expect(repartoConMiParte(A, B, -5)).toEqual({ [A]: 0, [B]: 100 });
  });

  it('reparto por defecto desde los miembros', () => {
    expect(repartoPorDefecto([{ user_id: A, porcentaje_defecto: 50 }, { user_id: B, porcentaje_defecto: 50 }])).toEqual({ [A]: 50, [B]: 50 });
  });
});
