import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../datos/cliente';

interface Espacio {
  id: string;
  nombre: string;
  tipo: 'individual' | 'compartido';
}

const CLAVE = 'finanzas-espacio';

// Recordar el espacio elegido es una comodidad por dispositivo: si el almacenamiento
// no está disponible (modo privado), la app sigue funcionando con el espacio individual.
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
    /* sin almacenamiento: no pasa nada */
  }
}

/** Selector Yo · Pareja · Piso (SPEC §5). Los espacios compartidos llegan en T13. */
export function SelectorEspacio() {
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [actual, setActual] = useState<string | null>(leerGuardado);

  useEffect(() => {
    void supabase()
      .from('espacios')
      .select('id, nombre, tipo')
      .order('tipo')
      .order('nombre')
      .then(({ data }) => {
        const lista = (data ?? []) as Espacio[];
        setEspacios(lista);
        setActual((previo) => (lista.some((e) => e.id === previo) ? previo : (lista[0]?.id ?? null)));
      });
  }, []);

  if (espacios.length === 0) return <span class="cabecera__espacio" />;

  return (
    <label class="cabecera__espacio">
      <span class="solo-lectores">Espacio</span>
      <select
        value={actual ?? ''}
        onChange={(e) => {
          setActual(e.currentTarget.value);
          guardar(e.currentTarget.value);
        }}
      >
        {espacios.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
