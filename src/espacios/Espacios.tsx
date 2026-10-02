import { useEffect, useState } from 'preact/hooks';
import { anadirMiembro, crearEspacioCompartido, idUsuarioActual, listarMiembros, type Miembro } from '../datos/repos/espacios';
import { problemasEmail, problemasNombreEspacio, sugerenciasPendientes } from './compartir';
import { recargarEspacios, useEspacios, type Espacio } from './estado';

function Errores({ errores }: { errores: string[] }) {
  if (errores.length === 0) return null;
  return (
    <ul class="error" role="alert">
      {errores.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

/** Ajustes → Espacios: crear «Pareja» y «Piso» y añadir a la otra persona por email (SPEC F2). */
export function AjustesEspacios() {
  const { cargado, espacios } = useEspacios();
  const compartidos = espacios.filter((e) => e.tipo === 'compartido');
  const ids = compartidos.map((e) => e.id).join(',');
  const [yo, setYo] = useState<string | null>(null);
  const [miembros, setMiembros] = useState<Record<string, Miembro[]>>({});
  const [errorCarga, setErrorCarga] = useState('');
  const [recargas, setRecargas] = useState(0);

  useEffect(() => {
    void idUsuarioActual().then(setYo);
  }, []);

  useEffect(() => {
    if (!ids) return;
    Promise.all(ids.split(',').map(async (id) => [id, await listarMiembros(id)] as const)).then(
      (pares) => setMiembros(Object.fromEntries(pares)),
      (e: Error) => setErrorCarga(e.message),
    );
  }, [ids, recargas]);

  if (!cargado) return <p class="cargando">Cargando…</p>;

  return (
    <section>
      <p>
        <a href="#/ajustes">‹ Ajustes</a>
      </p>
      <h1>Espacios</h1>
      <p class="nota">
        «Yo» es solo tuyo. En un espacio compartido, los dos miembros ven, apuntan, editan y borran todos sus gastos.
      </p>
      {errorCarga && (
        <p class="error" role="alert">
          {errorCarga}
        </p>
      )}

      {compartidos.map((e) => (
        <TarjetaEspacio
          key={e.id}
          espacio={e}
          miembros={miembros[e.id]}
          yo={yo}
          onAnadido={() => setRecargas((n) => n + 1)}
        />
      ))}

      <NuevoEspacio existentes={espacios.map((e) => e.nombre)} />
    </section>
  );
}

function TarjetaEspacio(props: { espacio: Espacio; miembros: Miembro[] | undefined; yo: string | null; onAnadido: () => void }) {
  const { espacio, miembros, yo, onAnadido } = props;
  const [email, setEmail] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const idTitulo = `espacio-${espacio.id}`;

  async function anadir(e: Event) {
    e.preventDefault();
    setMensaje('');
    const problemas = problemasEmail(email);
    setErrores(problemas);
    if (problemas.length > 0) return;
    setEnviando(true);
    try {
      await anadirMiembro(espacio.id, email);
      setMensaje(`Listo: ${email.trim()} ya puede ver «${espacio.nombre}».`);
      setEmail('');
      onAnadido();
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se ha podido añadir.']);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section class="tarjeta bloque" aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>{espacio.nombre}</h2>
      {miembros === undefined ? (
        <p class="nota">Cargando miembros…</p>
      ) : (
        <ul class="miembros" aria-label="Miembros">
          {miembros.map((m) => (
            <li key={m.user_id}>{m.user_id === yo ? 'Tú' : m.email}</li>
          ))}
        </ul>
      )}
      {mensaje && (
        <p class="aviso" role="status">
          {mensaje}
        </p>
      )}
      {miembros?.length === 1 && (
        <form class="formulario" onSubmit={(e) => void anadir(e)} noValidate>
          <p class="nota">Solo estás tú. Añade a la otra persona para que pueda ver y apuntar gastos aquí.</p>
          <label class="campo">
            <span>Email de la otra persona</span>
            <input type="email" autoComplete="off" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
          </label>
          <Errores errores={errores} />
          <button class="boton boton--principal" type="submit" disabled={enviando}>
            Añadir
          </button>
        </form>
      )}
    </section>
  );
}

function NuevoEspacio({ existentes }: { existentes: string[] }) {
  // Hasta que se escribe algo, se propone «Pareja» y después «Piso»
  const [nombre, setNombre] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valor = nombre ?? sugerenciasPendientes(existentes)[0] ?? '';

  async function crear(e: Event) {
    e.preventDefault();
    setMensaje('');
    const problemas = problemasNombreEspacio(valor, existentes);
    setErrores(problemas);
    if (problemas.length > 0) return;
    setEnviando(true);
    try {
      await crearEspacioCompartido(valor);
      await recargarEspacios();
      setNombre(null);
      setMensaje(`Espacio «${valor.trim()}» creado. Ahora añade a la otra persona con su email.`);
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se ha podido crear el espacio.']);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form class="formulario tarjeta bloque" onSubmit={(e) => void crear(e)} noValidate aria-labelledby="titulo-nuevo-espacio">
      <h2 id="titulo-nuevo-espacio">Nuevo espacio compartido</h2>
      <label class="campo">
        <span>Nombre del espacio</span>
        <input type="text" maxLength={60} value={valor} onInput={(e) => setNombre(e.currentTarget.value)} />
      </label>
      <Errores errores={errores} />
      {mensaje && (
        <p class="aviso" role="status">
          {mensaje}
        </p>
      )}
      <button class="boton boton--principal" type="submit" disabled={enviando}>
        Crear espacio
      </button>
    </form>
  );
}
