import { describe, expect, it } from 'vitest';
import {
  describirFrecuencia,
  ocurrenciaEnMes,
  ocurrenciasEntre,
  pendientesDelMes,
  proximaOcurrencia,
  type ReglaRecurrencia,
} from '../../src/movimientos/recurrencias';
import { mesesEntre, type ClaveMes, type FechaISO } from '../../src/nucleo/fechas';

const f = (s: string) => s as FechaISO;
const m = (s: string) => s as ClaveMes;
const regla = (desde: string, frecuencia: ReglaRecurrencia['frecuencia'] = 'mensual', hasta: string | null = null, cada_n = 1) =>
  ({ desde: f(desde), frecuencia, hasta: hasta ? f(hasta) : null, cada_n }) satisfies ReglaRecurrencia;

describe('recurrencias (CA4.4)', () => {
  it('mensual del 1 de enero al 31 de marzo → 3 ocurrencias', () => {
    expect(ocurrenciasEntre(regla('2026-01-01', 'mensual', '2026-03-31'), m('2025-12'), m('2026-06'))).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it('el día 31 cae en el último día de los meses cortos', () => {
    expect(ocurrenciasEntre(regla('2026-01-31'), m('2026-01'), m('2026-04'))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(ocurrenciaEnMes(regla('2024-01-31'), m('2024-02'))).toBe('2024-02-29');
  });

  it('trimestral, anual y cada N meses', () => {
    expect(ocurrenciasEntre(regla('2026-01-15', 'trimestral'), m('2026-01'), m('2026-12'))).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ]);
    expect(ocurrenciasEntre(regla('2025-06-10', 'anual'), m('2025-01'), m('2027-12'))).toEqual(['2025-06-10', '2026-06-10', '2027-06-10']);
    expect(ocurrenciasEntre(regla('2026-01-05', 'cada_n_meses', null, 2), m('2026-01'), m('2026-06'))).toEqual([
      '2026-01-05',
      '2026-03-05',
      '2026-05-05',
    ]);
  });

  it('nada antes de «desde» ni después de «hasta»', () => {
    expect(ocurrenciaEnMes(regla('2026-03-10'), m('2026-02'))).toBeNull();
    expect(ocurrenciaEnMes(regla('2026-03-10', 'mensual', '2026-05-09'), m('2026-05'))).toBeNull();
    expect(ocurrenciaEnMes(regla('2026-03-10', 'mensual', '2026-05-10'), m('2026-05'))).toBe('2026-05-10');
  });

  it('pendientes del mes: ajustar o confirmar una no afecta a las demás', () => {
    const recs = [
      { id: 'r1', ...regla('2026-01-01') },
      { id: 'r2', ...regla('2026-01-20') },
      { id: 'r3', ...regla('2026-01-05', 'trimestral') },
    ];
    const confirmadas = [{ recurrencia_id: 'r1', ocurrencia: '2026-02-01' }];
    expect(pendientesDelMes(recs, m('2026-02'), confirmadas).map((p) => [p.recurrencia.id, p.ocurrencia])).toEqual([['r2', '2026-02-20']]);
    expect(pendientesDelMes(recs, m('2026-03'), confirmadas).map((p) => p.recurrencia.id)).toEqual(['r1', 'r2']);
    expect(pendientesDelMes(recs, m('2026-04'), confirmadas).map((p) => p.recurrencia.id)).toEqual(['r1', 'r3', 'r2']);
  });

  it('próxima ocurrencia', () => {
    expect(proximaOcurrencia(regla('2026-01-15'), f('2026-10-01'))).toBe('2026-10-15');
    expect(proximaOcurrencia(regla('2026-01-15'), f('2026-10-16'))).toBe('2026-11-15');
    expect(proximaOcurrencia(regla('2026-12-01'), f('2026-10-01'))).toBe('2026-12-01');
    expect(proximaOcurrencia(regla('2026-01-15', 'anual'), f('2026-02-01'))).toBe('2027-01-15');
    expect(proximaOcurrencia(regla('2026-01-15', 'mensual', '2026-03-31'), f('2026-10-01'))).toBeNull();
  });

  it('describe la frecuencia', () => {
    expect(describirFrecuencia({ frecuencia: 'mensual', cada_n: 1 })).toBe('Cada mes');
    expect(describirFrecuencia({ frecuencia: 'trimestral', cada_n: 1 })).toBe('Cada 3 meses');
    expect(describirFrecuencia({ frecuencia: 'anual', cada_n: 1 })).toBe('Cada año');
    expect(describirFrecuencia({ frecuencia: 'cada_n_meses', cada_n: 2 })).toBe('Cada 2 meses');
  });

  it('meses entre', () => {
    expect(mesesEntre(m('2025-11'), m('2026-02'))).toBe(3);
    expect(mesesEntre(m('2026-02'), m('2025-11'))).toBe(-3);
  });
});
