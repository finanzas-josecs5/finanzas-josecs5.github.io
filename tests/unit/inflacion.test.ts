import { describe, expect, it } from 'vitest';
import type { FechaISO } from '../../src/nucleo/fechas';
import { estaDesactualizado, inflacionElegida, type DatosIpc } from '../../src/simulador/inflacion';

const IPC: DatosIpc = {
  serie: 'IPC290750',
  ultimo: { periodo: '2026-09', valor: 4.9, tipo: 'Avance' },
  media10: { desde: 2016, hasta: 2025, valor: 2.5 },
  obtenido: '2026-10-02T07:00:00.000Z',
  fuente: 'INE',
};

describe('inflación en el simulador (CA9.2, CA10.2)', () => {
  it('último dato, media de 10 años o manual', () => {
    expect(inflacionElegida(IPC, 'ultimo', 0)).toBeCloseTo(0.049);
    expect(inflacionElegida(IPC, 'media10', 0)).toBeCloseTo(0.025);
    expect(inflacionElegida(IPC, 'manual', 0.03)).toBe(0.03);
    expect(inflacionElegida({ ...IPC, media10: null }, 'media10', 0)).toBeNull();
  });

  it('avisa si el dato tiene más de 45 días', () => {
    expect(estaDesactualizado(IPC, '2026-11-16' as FechaISO)).toBe(false);
    expect(estaDesactualizado(IPC, '2026-11-17' as FechaISO)).toBe(true);
  });
});
