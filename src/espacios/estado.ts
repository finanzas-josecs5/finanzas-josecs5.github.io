import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../datos/cliente';

export interface Espacio {
  id: string;
  nombre: string;
  tipo: 'individual' | 'compartido';
}

interface Estado {
  cargado: boolean;
  espacios: Espacio[];
  actualId: string | null;
}

const CLAVE = 'finanzas-espacio';

// Recordar el espacio elegido es una comodidad por dispositivo: si el almacenamiento
// no está disponible (modo privado), se usa el espacio individual.
function leerGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

function guardar(id: string): void {
  try {
    localStorage.setItem(CLAVE, id);
  } catch {
    /* sin almacenamiento */
  }
}

let estado: Estado = { cargado: false, espacios: [], actualId: leerGuardado() };
const oyentes = new Set<(e: Estado) => void>();
let carga: Promise<void> | null = null;

function publicar(nuevo: Estado) {
  estado = nuevo;
  for (const oyente of oyentes) oyente(estado);
}

export function recargarEspacios(): Promise<void> {
  carga = (async () => {
    const { data, error } = await supabase()
      .from('espacios')
      .select('id, nombre, tipo')
      .order('tipo')
      .order('nombre');
    if (error) throw new Error('No se han podido cargar los espacios');
    const espacios = (data ?? []) as Espacio[];
    const individual = espacios.find((e) => e.tipo === 'individual') ?? espacios[0];
    const actualId = espacios.some((e) => e.id === estado.actualId) ? estado.actualId : (individual?.id ?? null);
    publicar({ cargado: true, espacios, actualId });
  })();
  return carga;
}

export function elegirEspacio(id: string): void {
  guardar(id);
  publicar({ ...estado, actualId: id });
}

/** Espacio seleccionado en la cabecera (Yo · Pareja · Piso) y la lista de espacios. */
export function useEspacios(): { cargado: boolean; espacios: Espacio[]; actual: Espacio | null } {
  const [actual, setActual] = useState(estado);
  useEffect(() => {
    oyentes.add(setActual);
    if (!carga) void recargarEspacios();
    return () => {
      oyentes.delete(setActual);
    };
  }, []);
  return {
    cargado: actual.cargado,
    espacios: actual.espacios,
    actual: actual.espacios.find((e) => e.id === actual.actualId) ?? null,
  };
}

/** Al cerrar sesión se olvida lo cargado (el siguiente usuario tiene otros espacios). */
export function olvidarEspacios(): void {
  carga = null;
  publicar({ cargado: false, espacios: [], actualId: leerGuardado() });
}
