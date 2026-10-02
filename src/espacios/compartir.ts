// Validaciones y mensajes de los espacios compartidos (SPEC F2). Las mismas reglas que la
// base de datos (migración 006), comprobadas antes en el navegador para dar mensajes claros.

const LONGITUD_MAXIMA_NOMBRE = 60;
const SUGERENCIAS = ['Pareja', 'Piso'];

function clave(nombre: string): string {
  return nombre.trim().toLocaleLowerCase('es-ES');
}

export function problemasNombreEspacio(nombre: string, existentes: string[] = []): string[] {
  const limpio = nombre.trim();
  if (limpio.length === 0) return ['Escribe un nombre, por ejemplo «Pareja» o «Piso».'];
  if (limpio.length > LONGITUD_MAXIMA_NOMBRE) return [`El nombre no puede tener más de ${LONGITUD_MAXIMA_NOMBRE} caracteres.`];
  if (existentes.some((e) => clave(e) === clave(limpio))) return ['Ya tienes un espacio con ese nombre.'];
  return [];
}

export function problemasEmail(email: string): string[] {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? [] : ['Escribe el email con el que entra la otra persona.'];
}

/** Traduce los códigos de error de crear_espacio_compartido y anadir_miembro. */
export function mensajeErrorEspacios(codigo: string | undefined): string {
  switch (codigo) {
    case 'PT404':
      return 'No hay ninguna cuenta con ese email. Las cuentas las crea el administrador.';
    case '23505':
      return 'Esa persona ya es miembro de este espacio.';
    case 'PT409':
      return 'Este espacio ya tiene dos miembros.';
    case '22023':
      return 'Tu espacio «Yo» no se puede compartir.';
    case '42501':
      return 'No tienes permiso para cambiar este espacio.';
    case '23514':
      return `El nombre debe tener entre 1 y ${LONGITUD_MAXIMA_NOMBRE} caracteres.`;
    default:
      return 'No se ha podido completar la operación. Comprueba la conexión e inténtalo de nuevo.';
  }
}

/** «Pareja» y «Piso» mientras aún no existan (SPEC §1.2). */
export function sugerenciasPendientes(existentes: string[]): string[] {
  const usados = new Set(existentes.map(clave));
  return SUGERENCIAS.filter((s) => !usados.has(clave(s)));
}
