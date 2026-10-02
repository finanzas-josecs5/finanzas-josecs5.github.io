import { useEffect, useState } from 'preact/hooks';
import {
  actualizarMovimiento,
  borrarMovimiento,
  obtenerMovimiento,
  recordarComercio,
  type Movimiento,
} from '../datos/repos/movimientos';
import { useEspacios } from '../espacios/estado';
import { useCompartido } from '../espacios/useCompartido';
import { navegar } from '../ui/router';
import { FormularioMovimiento, nombreMiembro } from './FormularioMovimiento';
import { useCategorias } from './Nuevo';

/** Editar o borrar un movimiento (SPEC F4). En los compartidos, cualquiera de los dos (P1). */
export function DetalleMovimiento({ id }: { id: string }) {
  const { espacios } = useEspacios();
  const [movimiento, setMovimiento] = useState<Movimiento | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const { categorias } = useCategorias(movimiento?.espacio_id);
  const compartido = useCompartido(movimiento?.espacio_id, espacios.find((e) => e.id === movimiento?.espacio_id)?.tipo);

  useEffect(() => {
    obtenerMovimiento(id).then(setMovimiento, (e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p class="error" role="alert">{error}</p>;
  if (movimiento === null) {
    return (
      <section>
        <h1>Movimiento no encontrado</h1>
        <p>
          Puede que se haya borrado. <a href="#/movimientos">Volver a movimientos</a>
        </p>
      </section>
    );
  }
  if (!movimiento || !categorias || compartido === undefined) return <p class="cargando">Cargando…</p>;

  async function borrar() {
    try {
      await borrarMovimiento(id);
      navegar('/movimientos');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido borrar.');
    }
  }

  return (
    <section>
      <p>
        <a href="#/movimientos">‹ Movimientos</a>
      </p>
      <h1>Editar movimiento</h1>
      {compartido && (
        // SPEC CA6.8: quién lo creó y quién lo modificó (lo fija el servidor, no se puede falsear)
        <dl class="auditoria" aria-label="Historial">
          <div>
            <dt>Creado por</dt>
            <dd>{nombreMiembro(movimiento.creado_por, compartido.yo, compartido.miembros)}</dd>
          </div>
          <div>
            <dt>Modificado por</dt>
            <dd>{nombreMiembro(movimiento.actualizado_por, compartido.yo, compartido.miembros)}</dd>
          </div>
        </dl>
      )}
      <FormularioMovimiento
        espacioId={movimiento.espacio_id}
        categorias={categorias}
        compartido={compartido}
        inicial={{
          sentido: movimiento.sentido,
          importe: movimiento.importe,
          texto: movimiento.comercio ?? movimiento.concepto ?? '',
          categoriaId: movimiento.categoria_id,
          fecha: movimiento.fecha,
          fijo: movimiento.naturaleza === 'fijo',
          pagadoPor: movimiento.pagado_por,
          reparto: movimiento.reparto,
        }}
        textoBoton="Guardar cambios"
        onGuardar={async (datos) => {
          await actualizarMovimiento(id, datos);
          if (datos.comercio) await recordarComercio(datos.espacio_id, datos.comercio, datos.categoria_id);
          navegar('/movimientos');
        }}
      />

      <div class="zona-peligro">
        {!confirmandoBorrado ? (
          <button class="boton boton--peligro" type="button" onClick={() => setConfirmandoBorrado(true)}>
            Borrar movimiento
          </button>
        ) : (
          <div role="group" aria-label="Confirmar borrado">
            <p>¿Seguro que quieres borrarlo? No se puede deshacer.</p>
            <button class="boton boton--peligro" type="button" onClick={() => void borrar()}>
              Sí, borrar
            </button>{' '}
            <button class="boton" type="button" onClick={() => setConfirmandoBorrado(false)}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
