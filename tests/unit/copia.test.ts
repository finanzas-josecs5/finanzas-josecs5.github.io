import { describe, expect, it } from 'vitest';
import { cifrar, descifrar, estaCifrado } from '../../src/copia/cifrado';
import { nombreArchivo, sinCamposServidor, validarCopia, type Copia } from '../../src/copia/formato';

const COPIA: Copia = {
  formato: 'finanzas-personales-datos',
  version: 1,
  exportado: '2026-10-02T10:00:00.000Z',
  individual: {
    nombre: 'Yo',
    categorias: [{ id: 'c1', nombre: 'Supermercado', sentido: 'salida', orden: 3 }],
    movimientos: [{ id: 'm1', fecha: '2026-09-05', importe: 1210, sentido: 'salida', categoria_id: 'c1' }],
    recurrencias: [],
    comercios: [],
    nomina: null,
    ajustes: null,
    liquidez: [],
    fondos: [],
    aportaciones: [],
    valoraciones: [],
  },
  compartidos: [],
};

describe('copia de seguridad (CA12.1)', () => {
  it('cifrar y descifrar con la contraseña devuelve lo mismo', async () => {
    const texto = JSON.stringify(COPIA);
    const archivo = await cifrar(texto, 'Clave-de-copia-2026!', 100_000);
    expect(estaCifrado(archivo)).toBe(true);
    expect(archivo.datos).not.toContain('Supermercado');
    await expect(descifrar(archivo, 'Clave-de-copia-2026!')).resolves.toBe(texto);
  });

  it('con una contraseña errónea o un archivo manipulado, falla', async () => {
    const archivo = await cifrar('hola', 'buena', 100_000);
    await expect(descifrar(archivo, 'mala')).rejects.toThrow('Contraseña incorrecta o archivo dañado.');
    const manipulado = { ...archivo, datos: archivo.datos.slice(0, -4) + 'AAAA' };
    await expect(descifrar(manipulado, 'buena')).rejects.toThrow('Contraseña incorrecta o archivo dañado.');
    await expect(descifrar({ ...archivo, cifrado: { ...archivo.cifrado, iteraciones: 1 } }, 'buena')).rejects.toThrow('parámetros');
  });

  it('cada cifrado usa salt e IV nuevos', async () => {
    const a = await cifrar('x', 'y', 100_000);
    const b = await cifrar('x', 'y', 100_000);
    expect(a.cifrado.salt).not.toBe(b.cifrado.salt);
    expect(a.cifrado.iv).not.toBe(b.cifrado.iv);
  });

  it('valida la estructura antes de importar', () => {
    expect(validarCopia(JSON.parse(JSON.stringify(COPIA)))).toEqual(COPIA);
    expect(() => validarCopia({})).toThrow('no es una copia');
    expect(() => validarCopia({ ...COPIA, version: 2 })).toThrow('versión');
    expect(() => validarCopia({ ...COPIA, individual: { ...COPIA.individual, movimientos: 'x' } })).toThrow('incompleta');
    expect(estaCifrado(COPIA)).toBe(false);
  });

  it('nombre del archivo y campos que pone el servidor', () => {
    expect(nombreArchivo(new Date(2026, 9, 2), true)).toBe('finanzas-2026-10-02.cifrado.json');
    expect(nombreArchivo(new Date(2026, 9, 2), false)).toBe('finanzas-2026-10-02.json');
    expect(sinCamposServidor({ id: 1, user_id: 'u', creado_por: 'u', nombre: 'A', espacio_id: 'e' }, ['espacio_id'])).toEqual({ id: 1, nombre: 'A' });
  });
});
