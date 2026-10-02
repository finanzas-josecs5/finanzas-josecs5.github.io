import { describe, expect, it } from 'vitest';
import { procesarRespuestaIne } from '../../scripts/obtener-ipc.ts';

// Respuesta del INE grabada (forma real de la API Tempus3 con tip=AM), sin acceder a la red
const DICIEMBRES = [1.6, 1.1, 1.2, 0.8, -0.5, 6.5, 5.7, 3.1, 2.8, 2.9];
const respuesta = {
  COD: 'IPC290750',
  Nombre: 'Nacional. Índice general. Variación anual. ',
  Data: [
    ...DICIEMBRES.map((valor, i) => ({ Anyo: 2016 + i, T3_Periodo: 'M12', T3_TipoDato: 'Definitivo', Valor: valor })),
    { Anyo: 2026, T3_Periodo: 'M08', T3_TipoDato: 'Definitivo', Valor: 4.3 },
    { Anyo: 2026, T3_Periodo: 'M09', T3_TipoDato: 'Avance', Valor: 4.9 },
  ],
};
const AHORA = new Date('2026-10-02T07:00:00Z');

describe('inflación del INE (CA10.1)', () => {
  it('último dato y media geométrica de 10 años', () => {
    expect(procesarRespuestaIne(respuesta, AHORA)).toEqual({
      serie: 'IPC290750',
      ultimo: { periodo: '2026-09', valor: 4.9, tipo: 'Avance' },
      media10: { desde: 2016, hasta: 2025, valor: 2.5 },
      obtenido: '2026-10-02T07:00:00.000Z',
      fuente: 'INE',
    });
  });

  it('sin 10 diciembres completos no hay media', () => {
    expect(procesarRespuestaIne({ ...respuesta, Data: respuesta.Data.slice(5) }, AHORA).media10).toBeNull();
  });

  it('descarta valores imposibles y se queda con el último válido', () => {
    const r = procesarRespuestaIne(
      { ...respuesta, Data: [...respuesta.Data, { Anyo: 2026, T3_Periodo: 'M10', Valor: 999 }, { Anyo: 2026, T3_Periodo: 'M11', Valor: 'x' }] },
      AHORA,
    );
    expect(r.ultimo).toEqual({ periodo: '2026-09', valor: 4.9, tipo: 'Avance' });
  });

  it.each([null, {}, { COD: 'OTRA', Data: [] }, { COD: 'IPC290750', Data: [] }, { COD: 'IPC290750', Data: [{ Anyo: 2026, T3_Periodo: 'M09', Valor: 50 }] }])(
    'respuesta no válida → error (el script usará el respaldo): %j',
    (malo) => {
      expect(() => procesarRespuestaIne(malo, AHORA)).toThrow();
    },
  );
});
