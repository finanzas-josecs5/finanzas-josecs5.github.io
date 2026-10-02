import { useEffect, useState } from 'preact/hooks';
import { idUsuarioActual, listarMiembros } from '../datos/repos/espacios';
import type { Compartido } from '../movimientos/FormularioMovimiento';

/**
 * Miembros y usuario actual de un espacio compartido; null en el espacio «Yo».
 * undefined mientras carga.
 */
export function useCompartido(espacioId: string | undefined, tipo: 'individual' | 'compartido' | undefined): Compartido | null | undefined {
  const [compartido, setCompartido] = useState<Compartido | null | undefined>(undefined);
  useEffect(() => {
    if (!espacioId || !tipo) return;
    if (tipo === 'individual') {
      setCompartido(null);
      return;
    }
    setCompartido(undefined);
    let vigente = true;
    Promise.all([listarMiembros(espacioId), idUsuarioActual()]).then(
      ([miembros, yo]) => {
        if (vigente) setCompartido(yo ? { yo, miembros } : null);
      },
      () => vigente && setCompartido(null),
    );
    return () => {
      vigente = false;
    };
  }, [espacioId, tipo]);
  return compartido;
}
