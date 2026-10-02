/**
 * Errores de un formulario. El role="alert" va en un contenedor y no en la lista: en un
 * <ul role="alert"> los <li> pierden su lista y los lectores de pantalla no los anuncian bien.
 */
export function ListaErrores({ errores }: { errores: readonly string[] }) {
  if (errores.length === 0) return null;
  return (
    <div class="error" role="alert">
      <ul>
        {errores.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
