import { describe, expect, it } from 'vitest';
import { idTitulo } from '../../src/consejos/Consejos';
import { consejos, UMBRALES_DEFECTO, type DatosConsejos, type MesResumido } from '../../src/consejos/reglas';
import { centimos } from '../../src/nucleo/dinero';
import type { ClaveMes, FechaISO } from '../../src/nucleo/fechas';

const NBSP = String.fromCharCode(0xa0);
const c = centimos;
const mes = (m: string, entradas: number, salidas: number, porCategoria: Record<string, number> = {}): MesResumido => ({
  mes: m as ClaveMes,
  entradas: c(entradas),
  salidas: c(salidas),
  porCategoria: Object.fromEntries(Object.entries(porCategoria).map(([k, v]) => [k, c(v)])),
});

const BASE: DatosConsejos = {
  hoy: '2026-10-02' as FechaISO,
  meses: [mes('2026-07', 200000, 150000), mes('2026-08', 200000, 150000), mes('2026-09', 200000, 150000)],
  liquidez: null,
  fondos: [],
  suscripciones: [],
  saldos: [],
};
const ids = (d: Partial<DatosConsejos>) => consejos({ ...BASE, ...d }).map((x) => x.id);

describe('id del título de un consejo', () => {
  it('sin espacios ni signos, para que aria-labelledby funcione', () => {
    expect(idTitulo('ter-alto:Fondo caro')).toBe('consejo-ter-alto-fondo-caro');
    expect(idTitulo('categoria-sube:Restaurantes y ocio')).toBe('consejo-categoria-sube-restaurantes-y-ocio');
    expect(idTitulo('saldo-pendiente:Piso nº 2')).toBe('consejo-saldo-pendiente-piso-n-2');
  });
});

describe('consejos por reglas (CA11.1)', () => {
  it('sin nada destacable, ningún consejo', () => {
    expect(consejos(BASE)).toEqual([]);
  });

  it('tasa de ahorro por debajo del 10 %: datos, cálculo y umbral concretos', () => {
    const r = consejos({ ...BASE, meses: [mes('2026-07', 200000, 190000), mes('2026-08', 200000, 190000), mes('2026-09', 200000, 190000)] });
    expect(r[0]).toMatchObject({ id: 'tasa-ahorro', severidad: 'aviso' });
    expect(r[0]?.texto).toContain(`5${NBSP}%`);
    expect(r[0]?.calculo).toBe(`(6.000,00${NBSP}€ − 5.700,00${NBSP}€) ÷ 6.000,00${NBSP}€ = 5${NBSP}%`);
    expect(r[0]?.umbral).toBe(`Menos del 10${NBSP}%`);
  });

  it('gastar más de lo que entra es importante', () => {
    expect(consejos({ ...BASE, meses: [mes('2026-09', 100000, 120000)] })[0]).toMatchObject({ id: 'tasa-ahorro', severidad: 'importante' });
  });

  it('colchón corto (< 3 meses) y liquidez de sobra (> 6 meses, con enlace al simulador)', () => {
    expect(ids({ liquidez: { fecha: '2026-10-01' as FechaISO, importe: c(300000) } })).toEqual(['colchon']);
    const exceso = consejos({ ...BASE, liquidez: { fecha: '2026-10-01' as FechaISO, importe: c(1320000) } })[0];
    expect(exceso?.id).toBe('exceso-liquidez');
    expect(exceso?.calculo).toBe(`13.200,00${NBSP}€ − 6 × 1.500,00${NBSP}€ = 4.200,00${NBSP}€`);
    expect(exceso?.enlace?.ruta).toBe('/simulador?inicial=4200');
    expect(ids({ liquidez: { fecha: '2026-10-01' as FechaISO, importe: c(600000) } })).toEqual([]);
  });

  it('TER alto en un indexado', () => {
    const r = consejos({ ...BASE, fondos: [{ nombre: 'Caro', ter: 0.8, ultimaValoracion: '2026-10-01' as FechaISO }, { nombre: 'Barato', ter: 0.12, ultimaValoracion: '2026-10-01' as FechaISO }] });
    expect(r.map((x) => x.id)).toEqual(['ter-alto:Caro']);
    expect(r[0]?.texto).toContain(`80,00${NBSP}€`);
  });

  it('una categoría sube más del 20 % sobre una media de al menos 30 €', () => {
    const meses = [
      mes('2026-06', 200000, 100000, { Restaurantes: 10000, Ropa: 1000 }),
      mes('2026-07', 200000, 100000, { Restaurantes: 10000, Ropa: 1000 }),
      mes('2026-08', 200000, 100000, { Restaurantes: 10000, Ropa: 1000 }),
      mes('2026-09', 200000, 100000, { Restaurantes: 13500, Ropa: 5000 }),
    ];
    const r = consejos({ ...BASE, meses });
    expect(r.map((x) => x.id)).toEqual(['categoria-sube:Restaurantes']);
    expect(r[0]?.titulo).toBe(`Restaurantes: +35${NBSP}% frente a tu media`);
  });

  it('suscripciones: suma anual informativa', () => {
    const r = consejos({ ...BASE, suscripciones: [{ nombre: 'Netflix', anual: c(15588) }, { nombre: 'Spotify', anual: c(12588) }] });
    expect(r[0]).toMatchObject({ id: 'suscripciones', severidad: 'info', titulo: `Tus suscripciones suman 281,76${NBSP}€ al año` });
  });

  it('saldo pendiente con la pareja durante más de 30 días', () => {
    const saldos = [
      { espacio: 'Piso', tipo: 'debes' as const, importe: c(4230), desde: '2026-08-22' as FechaISO },
      { espacio: 'Pareja', tipo: 'te-deben' as const, importe: c(1000), desde: '2026-09-25' as FechaISO },
    ];
    const r = consejos({ ...BASE, saldos });
    expect(r.map((x) => x.id)).toEqual(['saldo-pendiente:Piso']);
    expect(r[0]?.titulo).toBe('Piso: saldo pendiente desde hace 41 días');
  });

  it('fondos y liquidez sin actualizar en más de 30 días', () => {
    expect(
      ids({
        fondos: [{ nombre: 'MSCI', ter: 0.2, ultimaValoracion: '2026-08-01' as FechaISO }],
        liquidez: { fecha: '2026-08-15' as FechaISO, importe: c(600000) },
      }),
    ).toEqual(['fondo-sin-valorar:MSCI', 'liquidez-sin-actualizar']);
  });

  it('casos límite: sin meses, sin ingresos, sin fecha de saldo o con fondos sin valorar no hay consejo', () => {
    expect(ids({ meses: [], liquidez: { fecha: '2026-10-01' as FechaISO, importe: c(100) } })).toEqual([]);
    expect(ids({ meses: [mes('2026-09', 0, 5000)] })).toEqual([]);
    expect(ids({ meses: [mes('2026-09', 200000, 0)], liquidez: { fecha: '2026-10-01' as FechaISO, importe: c(100) } })).toEqual([]);
    expect(ids({ saldos: [{ espacio: 'Piso', tipo: 'debes', importe: c(100), desde: null }] })).toEqual([]);
    expect(ids({ fondos: [{ nombre: 'Nuevo', ter: 0.1, ultimaValoracion: null }] })).toEqual([]);
    // Con menos de 3 meses previos no se compara ninguna categoría
    expect(ids({ meses: [mes('2026-08', 200000, 100000, { Ropa: 5000 }), mes('2026-09', 200000, 100000, { Ropa: 50000 })] })).toEqual([]);
  });

  it('saldo a tu favor: «Te deben»', () => {
    const r = consejos({ ...BASE, saldos: [{ espacio: 'Pareja', tipo: 'te-deben', importe: c(2500), desde: '2026-08-01' as FechaISO }] });
    expect(r[0]?.texto).toBe(`Te deben 25,00${NBSP}€. ¿Lo saldáis?`);
  });

  it('los umbrales se pueden cambiar y el orden va de importante a informativo', () => {
    const r = consejos(
      { ...BASE, liquidez: { fecha: '2026-10-01' as FechaISO, importe: c(300000) }, suscripciones: [{ nombre: 'X', anual: c(100) }] },
      { ...UMBRALES_DEFECTO, mesesColchon: 1 },
    );
    expect(r.map((x) => x.id)).toEqual(['suscripciones']);
    expect(consejos({ ...BASE, liquidez: { fecha: '2026-10-01' as FechaISO, importe: c(300000) }, suscripciones: [{ nombre: 'X', anual: c(100) }] }).map((x) => x.severidad)).toEqual([
      'importante',
      'info',
    ]);
  });
});
