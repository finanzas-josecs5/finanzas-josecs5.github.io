import { describe, expect, it } from 'vitest';
import { coincide, leerRuta, RUTA_INICIO } from '../../src/ui/router';

describe('router por hash', () => {
  it('lee la ruta y la consulta', () => {
    const { ruta, consulta } = leerRuta('#/entrar?motivo=inactividad');
    expect(ruta).toBe('/entrar');
    expect(consulta.get('motivo')).toBe('inactividad');
  });

  it('sin hash o con hash vacío va al inicio', () => {
    expect(leerRuta('').ruta).toBe(RUTA_INICIO);
    expect(leerRuta('#').ruta).toBe(RUTA_INICIO);
    expect(leerRuta('#/').ruta).toBe(RUTA_INICIO);
    expect(leerRuta('#sin-barra').ruta).toBe(RUTA_INICIO);
  });

  it('quita la barra final', () => {
    expect(leerRuta('#/fondos/').ruta).toBe('/fondos');
  });

  it('extrae parámetros', () => {
    expect(coincide('/fondos/:id', '/fondos/abc%20d')).toEqual({ id: 'abc d' });
    expect(coincide('/fondos/:id', '/fondos')).toBeNull();
    expect(coincide('/fondos/:id/valorar', '/fondos/x/editar')).toBeNull();
    expect(coincide('/fondos/:id', '/fondos/')).toBeNull();
  });
});
