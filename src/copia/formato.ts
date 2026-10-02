// Formato de la copia de seguridad (SPEC §4.11). Solo datos: ningún identificador de sesión ni
// clave. Las relaciones se guardan por identificador original y se rehacen al importar.
export const VERSION_COPIA = 1;

type Fila = Record<string, unknown>;

export interface DatosEspacio {
  nombre: string;
  categorias: Fila[];
  movimientos: Fila[];
  recurrencias: Fila[];
  comercios: Fila[];
}

export interface Copia {
  formato: 'finanzas-personales-datos';
  version: typeof VERSION_COPIA;
  exportado: string;
  individual: DatosEspacio & {
    nomina: Fila | null;
    ajustes: Fila | null;
    liquidez: Fila[];
    fondos: Fila[];
    aportaciones: Fila[];
    valoraciones: Fila[];
  };
  /** Solo como copia: al importar no se tocan (son también de la otra persona) */
  compartidos: (DatosEspacio & { liquidaciones: Fila[] })[];
}

const esLista = (v: unknown): v is Fila[] => Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null);

/** Comprueba la estructura antes de tocar nada en la base de datos. */
export function validarCopia(valor: unknown): Copia {
  const c = valor as Partial<Copia> | null;
  if (c?.formato !== 'finanzas-personales-datos') throw new Error('Este archivo no es una copia de Finanzas.');
  if (c.version !== VERSION_COPIA) throw new Error('La copia es de una versión que esta app no sabe leer.');
  const i = c.individual;
  const listas = ['categorias', 'movimientos', 'recurrencias', 'comercios', 'liquidez', 'fondos', 'aportaciones', 'valoraciones'] as const;
  if (!i || listas.some((l) => !esLista(i[l])) || !Array.isArray(c.compartidos)) throw new Error('La copia está incompleta o dañada.');
  return c as Copia;
}

export function nombreArchivo(fecha: Date, cifrado: boolean): string {
  const f = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  return `finanzas-${f}${cifrado ? '.cifrado' : ''}.json`;
}

/** Columnas de una fila sin las que pone el servidor (auditoría) ni el propietario. */
export function sinCamposServidor(fila: Fila, quitar: readonly string[] = []): Fila {
  const fuera = new Set(['creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'user_id', ...quitar]);
  return Object.fromEntries(Object.entries(fila).filter(([k]) => !fuera.has(k)));
}
