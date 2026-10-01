import { describe, expect, it } from 'vitest';
import { mensajeErrorAuth, problemasContrasena } from '../../src/acceso/contrasena';
import { RelojInactividad } from '../../src/acceso/inactividad';

describe('RelojInactividad (CA1.5)', () => {
  const MIN = 60_000;

  it('expira a los 30 minutos sin actividad', () => {
    const reloj = new RelojInactividad(30 * MIN, 0);
    expect(reloj.haExpirado(29 * MIN)).toBe(false);
    expect(reloj.haExpirado(30 * MIN)).toBe(true);
  });

  it('la actividad reinicia la cuenta', () => {
    const reloj = new RelojInactividad(30 * MIN, 0);
    reloj.registrarActividad(20 * MIN);
    expect(reloj.haExpirado(45 * MIN)).toBe(false);
    expect(reloj.haExpirado(50 * MIN)).toBe(true);
  });

  it('una marca de tiempo antigua no retrasa la expiración', () => {
    const reloj = new RelojInactividad(30 * MIN, 10 * MIN);
    reloj.registrarActividad(5 * MIN);
    expect(reloj.haExpirado(40 * MIN)).toBe(true);
  });
});

describe('problemasContrasena (CA1.3)', () => {
  it('acepta una contraseña que cumple todo', () => {
    expect(problemasContrasena('Pájaro-azul-2026', 'Pájaro-azul-2026')).toEqual([]);
  });

  it('explica cada requisito que falta', () => {
    expect(problemasContrasena('corta', 'otra')).toEqual([
      'Debe tener al menos 12 caracteres.',
      'Debe incluir una mayúscula.',
      'Debe incluir un número.',
      'Debe incluir un símbolo (por ejemplo ! ? # %).',
      'Las dos contraseñas no coinciden.',
    ]);
    expect(problemasContrasena('TODOMAYUSCULAS1!', 'TODOMAYUSCULAS1!')).toEqual(['Debe incluir una minúscula.']);
  });
});

describe('mensajeErrorAuth', () => {
  it.each([
    ['Invalid login credentials', 'Email o contraseña incorrectos.'],
    ['Request rate limit reached', 'Demasiados intentos. Espera unos minutos y vuelve a probar.'],
    ['New password should be different from the old password.', 'La nueva contraseña debe ser distinta de la actual.'],
    ['Password is known to be weak and easy to guess', 'La contraseña no cumple los requisitos de seguridad.'],
    ['Failed to fetch', 'No hay conexión con el servidor. Comprueba tu conexión.'],
    ['algo raro', 'No se ha podido completar la operación. Inténtalo de nuevo.'],
  ])('«%s»', (original, traducido) => {
    expect(mensajeErrorAuth(original)).toBe(traducido);
  });
});
