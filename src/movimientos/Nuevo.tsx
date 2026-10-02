import { useEffect, useState } from 'preact/hooks';
import { crearMovimiento, listarCategorias, recordarComercio, type Categoria } from '../datos/repos/movimientos';
import { obtenerRecurrencia } from '../datos/repos/recurrencias';
import { useEspacios } from '../espacios/estado';
import { useCompartido } from '../espacios/useCompartido';
import { esFechaISO } from '../nucleo/fechas';
import { nombreDia } from '../nucleo/textos';
import { navegar, useRuta } from '../ui/router';
import { FormularioMovimiento, type ValoresIniciales } from './FormularioMovimiento';
import type { Recurrencia } from './recurrencias';

export function useCategorias(espacioId: string | undefined): { categorias: Categoria[] | null; error: string } {
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!espacioId) return;
    setCategorias(null);
    listarCategorias(espacioId).then(setCategorias, (e: Error) => setError(e.message));
  }, [espacioId]);
  return { categorias, error };
}

/**
 * Alta rápida de un gasto o ingreso (SPEC F4, CA4.1). Con ?recurrencia=…&ocurrencia=… sirve
 * para ajustar una ocurrencia de un recurrente antes de confirmarla (CA4.4).
 */
export function NuevoMovimiento() {
  const { actual, espacios } = useEspacios();
  const { consulta } = useRuta();
  const idRecurrencia = consulta.get('recurrencia');
  const ocurrencia = consulta.get('ocurrencia');
  const [recurrencia, setRecurrencia] = useState<Recurrencia | null | undefined>(idRecurrencia ? undefined : null);
  const espacioId = recurrencia?.espacio_id ?? actual?.id;
  const { categorias, error } = useCategorias(espacioId);
  const compartido = useCompartido(espacioId, espacios.find((e) => e.id === espacioId)?.tipo);

  useEffect(() => {
    if (idRecurrencia) obtenerRecurrencia(idRecurrencia).then(setRecurrencia, () => setRecurrencia(null));
  }, [idRecurrencia]);

  if (error) return <p class="error" role="alert">{error}</p>;
  if (!actual || !espacioId || !categorias || recurrencia === undefined || compartido === undefined) {
    return <p class="cargando">Cargando…</p>;
  }

  const ajustando = recurrencia && ocurrencia && esFechaISO(ocurrencia) ? { recurrencia, ocurrencia } : null;
  const inicial: ValoresIniciales | undefined = ajustando
    ? {
        sentido: ajustando.recurrencia.sentido,
        importe: ajustando.recurrencia.importe,
        texto: ajustando.recurrencia.comercio ?? ajustando.recurrencia.concepto ?? '',
        categoriaId: ajustando.recurrencia.categoria_id,
        fecha: ajustando.ocurrencia,
        fijo: ajustando.recurrencia.naturaleza === 'fijo',
      }
    : undefined;

  return (
    <section>
      <h1>{ajustando ? 'Ajustar recurrente' : 'Añadir movimiento'}</h1>
      <p class="nota">
        {ajustando
          ? `Previsto para el ${nombreDia(ajustando.ocurrencia).toLowerCase()}. Cambia lo que haga falta y confirma.`
          : `Espacio: ${actual.nombre}`}
      </p>
      <FormularioMovimiento
        key={`${espacioId}-${idRecurrencia ?? ''}`}
        espacioId={espacioId}
        categorias={categorias}
        inicial={inicial}
        compartido={compartido}
        textoBoton={ajustando ? 'Confirmar' : 'Guardar'}
        onGuardar={async (datos) => {
          await crearMovimiento(
            ajustando ? { ...datos, recurrencia_id: ajustando.recurrencia.id, ocurrencia: ajustando.ocurrencia } : datos,
          );
          if (datos.comercio) await recordarComercio(datos.espacio_id, datos.comercio, datos.categoria_id);
          navegar('/movimientos');
        }}
      />
    </section>
  );
}
