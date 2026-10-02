import { describe, expect, it } from 'vitest';
import {
  mensajeErrorEspacios,
  problemasEmail,
  problemasNombreEspacio,
  sugerenciasPendientes,
} from '../../src/espacios/compartir';

describe('problemasNombreEspacio', () => {
  it('acepta «Pareja» y «Piso»', () => {
    expect(problemasNombreEspacio('Pareja')).toEqual([]);
    expect(problemasNombreEspacio('  Piso ')).toEqual([]);
  });

  it('rechaza un nombre vacío o solo con espacios', () => {
    expect(problemasNombreEspacio('   ')).toEqual(['Escribe un nombre, por ejemplo «Pareja» o «Piso».']);
  });

  it('rechaza más de 60 caracteres, como la base de datos', () => {
    expect(problemasNombreEspacio('x'.repeat(60))).toEqual([]);
    expect(problemasNombreEspacio('x'.repeat(61))).toEqual(['El nombre no puede tener más de 60 caracteres.']);
  });

  it('no deja repetir el nombre de otro espacio, sin distinguir mayúsculas', () => {
    expect(problemasNombreEspacio('pareja', ['Yo', 'Pareja'])).toEqual(['Ya tienes un espacio con ese nombre.']);
  });
});

describe('problemasEmail', () => {
  it('acepta un email con espacios alrededor', () => {
    expect(problemasEmail('  ana@ejemplo.es ')).toEqual([]);
  });

  it('rechaza lo que no parece un email', () => {
    for (const email of ['', 'ana', 'ana@', '@ejemplo.es', 'ana@ejemplo', 'ana @ejemplo.es']) {
      expect(problemasEmail(email)).toEqual(['Escribe el email con el que entra la otra persona.']);
    }
  });
});

describe('mensajeErrorEspacios (códigos de la migración 006)', () => {
  it.each([
    ['PT404', 'No hay ninguna cuenta con ese email. Las cuentas las crea el administrador.'],
    ['23505', 'Esa persona ya es miembro de este espacio.'],
    ['PT409', 'Este espacio ya tiene dos miembros.'],
    ['22023', 'Tu espacio «Yo» no se puede compartir.'],
    ['42501', 'No tienes permiso para cambiar este espacio.'],
    ['23514', 'El nombre debe tener entre 1 y 60 caracteres.'],
  ])('%s → mensaje claro', (codigo, mensaje) => {
    expect(mensajeErrorEspacios(codigo)).toBe(mensaje);
  });

  it('cualquier otro error (o sin conexión) da un mensaje genérico', () => {
    const generico = 'No se ha podido completar la operación. Comprueba la conexión e inténtalo de nuevo.';
    expect(mensajeErrorEspacios(undefined)).toBe(generico);
    expect(mensajeErrorEspacios('XX000')).toBe(generico);
  });
});

describe('sugerenciasPendientes', () => {
  it('propone «Pareja» y «Piso» mientras no existan', () => {
    expect(sugerenciasPendientes(['Yo'])).toEqual(['Pareja', 'Piso']);
    expect(sugerenciasPendientes(['Yo', 'pareja'])).toEqual(['Piso']);
    expect(sugerenciasPendientes(['Yo', 'Pareja', 'Piso'])).toEqual([]);
  });
});
