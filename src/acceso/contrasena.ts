// Reglas de contraseña: las mismas que exige Supabase Auth (config.toml, SPEC CA1.3),
// comprobadas antes en el navegador para dar mensajes claros en español.
export const LONGITUD_MINIMA = 12;

export function problemasContrasena(contrasena: string, repetida: string): string[] {
  const problemas: string[] = [];
  if (contrasena.length < LONGITUD_MINIMA) problemas.push(`Debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
  if (!/\p{Ll}/u.test(contrasena)) problemas.push('Debe incluir una minúscula.');
  if (!/\p{Lu}/u.test(contrasena)) problemas.push('Debe incluir una mayúscula.');
  if (!/\d/.test(contrasena)) problemas.push('Debe incluir un número.');
  if (!/[^\p{L}\d\s]/u.test(contrasena)) problemas.push('Debe incluir un símbolo (por ejemplo ! ? # %).');
  if (contrasena !== repetida) problemas.push('Las dos contraseñas no coinciden.');
  return problemas;
}

/** Traduce los errores de Supabase Auth más habituales. */
export function mensajeErrorAuth(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) return 'Email o contraseña incorrectos.';
  if (/rate limit|too many/i.test(mensaje)) return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
  if (/same.*password|different from the old/i.test(mensaje)) return 'La nueva contraseña debe ser distinta de la actual.';
  if (/weak|password should/i.test(mensaje)) return 'La contraseña no cumple los requisitos de seguridad.';
  if (/fetch|network/i.test(mensaje)) return 'No hay conexión con el servidor. Comprueba tu conexión.';
  return 'No se ha podido completar la operación. Inténtalo de nuevo.';
}
