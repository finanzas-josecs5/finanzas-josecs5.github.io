import { useEffect, useState } from 'preact/hooks';
import { crearMovimiento, listarCategorias, recordarComercio, type Categoria } from '../datos/repos/movimientos';
import { useEspacios } from '../espacios/estado';
import { navegar } from '../ui/router';
import { FormularioMovimiento } from './FormularioMovimiento';

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

/** Alta rápida de un gasto o ingreso (SPEC F4, CA4.1). */
export function NuevoMovimiento() {
  const { actual } = useEspacios();
  const { categorias, error } = useCategorias(actual?.id);

  if (error) return <p class="error" role="alert">{error}</p>;
  if (!actual || !categorias) return <p class="cargando">Cargando…</p>;

  return (
    <section>
      <h1>Añadir movimiento</h1>
      <p class="nota">Espacio: {actual.nombre}</p>
      <FormularioMovimiento
        key={actual.id}
        espacioId={actual.id}
        categorias={categorias}
        textoBoton="Guardar"
        onGuardar={async (datos) => {
          await crearMovimiento(datos);
          if (datos.comercio) await recordarComercio(datos.espacio_id, datos.comercio, datos.categoria_id);
          navegar('/movimientos');
        }}
      />
    </section>
  );
}
