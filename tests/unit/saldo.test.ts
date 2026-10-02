import { describe, expect, it } from 'vitest';
import { estadoPara, liquidacionPendiente, saldos, type Liquidacion, type MovimientoComun } from '../../src/comun/saldo';
import { centimos } from '../../src/nucleo/dinero';

const A = 'aaaa';
const B = 'bbbb';
const MITAD = { [A]: 50, [B]: 50 };

const gasto = (importe: number, pagado_por: string, reparto = MITAD): MovimientoComun => ({
  importe: centimos(importe),
  sentido: 'salida',
  pagado_por,
  reparto,
});

describe('saldo de un espacio compartido', () => {
  it('CA6.2: A paga 100 € y B paga 30 €, al 50/50 → B debe 35,00 € a A', () => {
    const s = saldos([gasto(10000, A), gasto(3000, B)], []);
    expect(s.get(A)).toBe(3500);
    expect(s.get(B)).toBe(-3500);
    expect(estadoPara(A, B, s)).toEqual({ tipo: 'te-deben', importe: 3500, deudor: B });
    expect(estadoPara(B, A, s)).toEqual({ tipo: 'debes', importe: 3500, acreedor: A });
  });

  it('CA6.2: tras saldar 35,00 € el saldo es 0', () => {
    const pendiente = liquidacionPendiente(B, A, saldos([gasto(10000, A), gasto(3000, B)], []));
    expect(pendiente).toEqual({ de_user: B, a_user: A, importe: 3500 });
    const s = saldos([gasto(10000, A), gasto(3000, B)], [pendiente as Liquidacion]);
    expect(s.get(A)).toBe(0);
    expect(estadoPara(A, B, s)).toEqual({ tipo: 'en-paz' });
    expect(liquidacionPendiente(A, B, s)).toBeNull();
  });

  it('una liquidación parcial deja el resto pendiente', () => {
    const s = saldos([gasto(10000, A)], [{ de_user: B, a_user: A, importe: centimos(2000) }]);
    expect(estadoPara(B, A, s)).toEqual({ tipo: 'debes', importe: 3000, acreedor: A });
    expect(liquidacionPendiente(A, B, s)).toEqual({ de_user: B, a_user: A, importe: 3000 });
  });

  it('reparto propio de un gasto (70/30) y céntimos sueltos', () => {
    expect(saldos([gasto(10000, A, { [A]: 70, [B]: 30 })], []).get(B)).toBe(-3000);
    // 10,01 € al 50/50 pagado por A: B pone 5,00 → debe 5,00
    expect(saldos([gasto(1001, A)], []).get(B)).toBe(-500);
  });

  it('un ingreso común lo reparte quien lo cobra', () => {
    const devolucion: MovimientoComun = { importe: centimos(2000), sentido: 'entrada', pagado_por: A, reparto: MITAD };
    expect(saldos([devolucion], []).get(A)).toBe(-1000);
  });

  it('los movimientos sin reparto no cuentan', () => {
    expect(saldos([{ ...gasto(1000, A), reparto: null }], []).size).toBe(0);
  });

  it('CA6.4 (propiedad): con cualquier secuencia, los saldos suman 0', () => {
    // Generador pseudoaleatorio con semilla: reproducible y sin dependencias
    let semilla = 20261002;
    const azar = (max: number) => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla % max;
    };
    for (let caso = 0; caso < 200; caso += 1) {
      const movimientos: MovimientoComun[] = [];
      const liquidaciones: Liquidacion[] = [];
      for (let i = 0; i < 1 + azar(15); i += 1) {
        const mio = azar(101);
        movimientos.push({
          importe: centimos(1 + azar(500000)),
          sentido: azar(5) === 0 ? 'entrada' : 'salida',
          pagado_por: azar(2) === 0 ? A : B,
          reparto: { [A]: mio, [B]: 100 - mio },
        });
      }
      for (let i = 0; i < azar(4); i += 1) {
        const deA = azar(2) === 0;
        liquidaciones.push({ de_user: deA ? A : B, a_user: deA ? B : A, importe: centimos(1 + azar(100000)) });
      }
      const s = saldos(movimientos, liquidaciones);
      expect((s.get(A) ?? 0) + (s.get(B) ?? 0)).toBe(0);
      // Saldar lo pendiente siempre deja a cero
      const pendiente = liquidacionPendiente(A, B, s);
      const final = saldos(movimientos, pendiente ? [...liquidaciones, pendiente] : liquidaciones);
      expect(final.get(A) ?? 0).toBe(0);
    }
  });
});
