import { describe, expect, it } from 'vitest';
import { categoriaComun, misPartes, type MovimientoCompartido } from '../../src/comun/miParte';
import { resumenDelMes } from '../../src/movimientos/resumen';
import { centimos } from '../../src/nucleo/dinero';
import type { FechaISO } from '../../src/nucleo/fechas';

const A = 'aaaa';
const B = 'bbbb';
const mov = (importe: number, pagado_por: string, reparto: Record<string, number> | null = { [A]: 50, [B]: 50 }): MovimientoCompartido => ({
  fecha: '2026-09-10' as FechaISO,
  importe: centimos(importe),
  sentido: 'salida',
  naturaleza: 'variable',
  pagado_por,
  reparto,
});

describe('mi parte de lo común (CA6.3)', () => {
  it('un gasto común de 100 € al 50/50 pagado por A cuenta 50,00 € en el resumen de A', () => {
    const partes = misPartes([mov(10000, A)], A, 'pareja');
    expect(partes).toEqual([
      { fecha: '2026-09-10', importe: 5000, sentido: 'salida', naturaleza: 'variable', categoria_id: 'comun:salida:pareja' },
    ]);
    const r = resumenDelMes(partes, [categoriaComun('pareja', 'Pareja', 'salida')], { vista: 'caja', nomina: null });
    expect(r.salidas).toBe(5000);
    expect(r.salidasPorCategoria[0]?.nombre).toBe('Común · Pareja');
  });

  it('también cuenta mi parte de lo que pagó la otra persona', () => {
    expect(misPartes([mov(3000, B)], A, 'pareja')[0]?.importe).toBe(1500);
  });

  it('se omiten las partes de 0 € y los movimientos sin reparto', () => {
    expect(misPartes([mov(1000, B, { [B]: 100 }), mov(1000, A, null)], A, 'pareja')).toEqual([]);
  });
});
