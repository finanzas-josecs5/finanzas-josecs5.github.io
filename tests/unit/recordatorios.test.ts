import { describe, expect, it } from 'vitest';
import { recordatorios } from '../../src/cartera/recordatorios';
import type { FechaISO } from '../../src/nucleo/fechas';
import { extraerValor } from '../../src/ocr/extraerValor';

const f = (s: string) => s as FechaISO;
const HOY = f('2026-10-02');

describe('recordatorios (CA8.3, CA8.5)', () => {
  it('fondo con el último valor de hace más de 30 días', () => {
    const r = recordatorios(HOY, [{ id: 'f1', nombre: 'MSCI World', ultimaValoracion: f('2026-08-28') }], undefined);
    expect(r).toEqual([{ tipo: 'fondo', texto: 'Actualiza el valor de MSCI World (hace 35 días)', enlace: '#/fondos/f1/valorar', dias: 35 }]);
  });

  it('a los 30 días justos todavía no avisa; un fondo sin valorar, sí', () => {
    expect(recordatorios(HOY, [{ id: 'f1', nombre: 'A', ultimaValoracion: f('2026-09-02') }], undefined)).toEqual([]);
    expect(recordatorios(HOY, [{ id: 'f2', nombre: 'B', ultimaValoracion: null }], undefined)[0]?.texto).toBe(
      'Apunta el valor de B (aún no tiene ninguno)',
    );
  });

  it('liquidez: sin apuntar, desactualizada o al día', () => {
    expect(recordatorios(HOY, [], null)[0]).toMatchObject({ tipo: 'liquidez', texto: 'Apunta tu liquidez (saldo de tus cuentas)' });
    expect(recordatorios(HOY, [], f('2026-08-29'))[0]?.texto).toBe('Actualiza tu liquidez (hace 34 días)');
    expect(recordatorios(HOY, [], f('2026-09-20'))).toEqual([]);
  });

  it('días configurables', () => {
    expect(recordatorios(HOY, [], f('2026-09-20'), 7)).toHaveLength(1);
  });
});

describe('valor desde una captura del bróker (CA8.4)', () => {
  it('toma el valor de la posición, no la rentabilidad ni lo aportado', () => {
    const texto = `Vanguard Global Stock Index
Valor de la posición
12.345,67 €
Importe invertido 10.000,00 €
Rentabilidad +2.345,67 € (+23,46 %)
Valor liquidativo 45,21 €`;
    expect(extraerValor(texto)).toEqual({ valor: 1234567, confianza: 'alta' });
  });

  it('con la etiqueta en la misma línea', () => {
    expect(extraerValor('Saldo total: 3.210,00 €\nComisión 1,20 €')).toEqual({ valor: 321000, confianza: 'alta' });
  });

  it('sin etiqueta: el importe mayor, con confianza baja', () => {
    expect(extraerValor('MSCI World\n1.050,10\n12,30')).toEqual({ valor: 105010, confianza: 'baja' });
    expect(extraerValor('sin importes')).toEqual({ valor: null, confianza: 'baja' });
  });
});
