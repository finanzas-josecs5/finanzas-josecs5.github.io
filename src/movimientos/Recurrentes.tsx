import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Categoria, Sentido } from '../datos/repos/movimientos';
import {
  actualizarRecurrencia,
  borrarRecurrencia,
  crearRecurrencia,
  listarRecurrencias,
  obtenerRecurrencia,
  type DatosRecurrencia,
} from '../datos/repos/recurrencias';
import { useEspacios } from '../espacios/estado';
import { parsearImporte, textoEditable } from '../nucleo/dinero';
import { esFechaISO, hoy } from '../nucleo/fechas';
import { formatearEUR } from '../nucleo/formato';
import { nombreDia } from '../nucleo/textos';
import { ListaErrores } from '../ui/ListaErrores';
import { navegar } from '../ui/router';
import { useCategorias } from './Nuevo';
import { describirFrecuencia, proximaOcurrencia, type Frecuencia, type Recurrencia } from './recurrencias';

/** Lista de gastos e ingresos recurrentes del espacio (SPEC §4.3). */
export function ListaRecurrentes() {
  const { actual } = useEspacios();
  const { categorias } = useCategorias(actual?.id);
  const [recurrencias, setRecurrencias] = useState<Recurrencia[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!actual) return;
    setRecurrencias(null);
    listarRecurrencias(actual.id).then(setRecurrencias, (e: Error) => setError(e.message));
  }, [actual?.id]);

  const nombreCategoria = useMemo(() => new Map((categorias ?? []).map((c) => [c.id, c.nombre])), [categorias]);
  const hoyISO = hoy();

  return (
    <section>
      <p>
        <a href="#/movimientos">‹ Movimientos</a>
      </p>
      <h1>Recurrentes</h1>
      <p class="nota">Alquiler, suscripciones, nómina… Cada mes aparecen en Movimientos para confirmarlos o ajustarlos.</p>
      <p>
        <a class="boton" href="#/recurrentes/nuevo">
          Nuevo recurrente
        </a>
      </p>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      {!error && recurrencias === null && <p class="cargando">Cargando…</p>}
      {recurrencias?.length === 0 && <p class="vacio">Aún no hay recurrentes en este espacio.</p>}
      {recurrencias && recurrencias.length > 0 && (
        <ul class="lista-movimientos">
          {recurrencias.map((r) => {
            const proxima = proximaOcurrencia(r, hoyISO);
            return (
              <li key={r.id}>
                <a href={`#/recurrentes/${r.id}`}>
                  <span class="movimiento__texto">
                    <strong>{r.comercio ?? r.concepto ?? nombreCategoria.get(r.categoria_id) ?? 'Recurrente'}</strong>
                    <span class="nota">
                      {describirFrecuencia(r)} · {proxima ? `Próximo: ${nombreDia(proxima)}` : 'Terminado'}
                    </span>
                  </span>
                  <span class={`importe importe--${r.sentido}`}>
                    {r.sentido === 'entrada' ? '+' : '−'}
                    {formatearEUR(r.importe)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Alta y edición de un recurrente. */
export function EditarRecurrente({ id }: { id: string | null }) {
  const { actual } = useEspacios();
  const [recurrencia, setRecurrencia] = useState<Recurrencia | null | undefined>(id ? undefined : null);
  const [error, setError] = useState('');
  const espacioId = recurrencia?.espacio_id ?? actual?.id;
  const { categorias } = useCategorias(espacioId);

  useEffect(() => {
    if (id) obtenerRecurrencia(id).then(setRecurrencia, (e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p class="error" role="alert">{error}</p>;
  if (id && recurrencia === null) {
    return (
      <section>
        <h1>Recurrente no encontrado</h1>
        <p>
          <a href="#/recurrentes">Volver a recurrentes</a>
        </p>
      </section>
    );
  }
  if (recurrencia === undefined || !espacioId || !categorias) return <p class="cargando">Cargando…</p>;

  return (
    <section>
      <p>
        <a href="#/recurrentes">‹ Recurrentes</a>
      </p>
      <h1>{id ? 'Editar recurrente' : 'Nuevo recurrente'}</h1>
      <FormularioRecurrente
        espacioId={espacioId}
        categorias={categorias}
        inicial={recurrencia}
        onGuardar={async (datos) => {
          if (id) await actualizarRecurrencia(id, datos);
          else await crearRecurrencia(datos);
          navegar('/recurrentes');
        }}
        onBorrar={
          id
            ? async () => {
                await borrarRecurrencia(id);
                navegar('/recurrentes');
              }
            : undefined
        }
      />
    </section>
  );
}

interface PropsFormulario {
  espacioId: string;
  categorias: Categoria[];
  inicial: Recurrencia | null;
  onGuardar: (datos: DatosRecurrencia) => Promise<void>;
  onBorrar: (() => Promise<void>) | undefined;
}

function FormularioRecurrente({ espacioId, categorias, inicial, onGuardar, onBorrar }: PropsFormulario) {
  const [sentido, setSentido] = useState<Sentido>(inicial?.sentido ?? 'salida');
  const [importeTexto, setImporteTexto] = useState(inicial ? textoEditable(inicial.importe) : '');
  const [texto, setTexto] = useState(inicial?.comercio ?? inicial?.concepto ?? '');
  const [categoriaId, setCategoriaId] = useState(inicial?.categoria_id ?? '');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(inicial?.frecuencia ?? 'mensual');
  const [cadaN, setCadaN] = useState(String(inicial?.cada_n ?? 2));
  const [desde, setDesde] = useState<string>(inicial?.desde ?? hoy());
  const [hasta, setHasta] = useState<string>(inicial?.hasta ?? '');
  const [fijo, setFijo] = useState((inicial?.naturaleza ?? 'fijo') === 'fijo');
  const [errores, setErrores] = useState<string[]>([]);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const campoImporte = useRef<HTMLInputElement>(null);

  useEffect(() => campoImporte.current?.focus(), []);
  const delSentido = categorias.filter((c) => c.sentido === sentido);

  async function enviar(e: Event) {
    e.preventDefault();
    const problemas: string[] = [];
    const importe = parsearImporte(importeTexto);
    if (!importe.ok || importe.importe <= 0) problemas.push('Escribe un importe válido mayor que cero (por ejemplo 12,99).');
    if (!delSentido.some((c) => c.id === categoriaId)) problemas.push('Elige una categoría.');
    if (!esFechaISO(desde)) problemas.push('La fecha de inicio no es válida.');
    if (hasta && (!esFechaISO(hasta) || hasta < desde)) problemas.push('La fecha final debe ser posterior a la de inicio.');
    const n = Number(cadaN);
    if (frecuencia === 'cada_n_meses' && !(Number.isInteger(n) && n >= 1 && n <= 24)) {
      problemas.push('«Cada cuántos meses» debe ser un número entre 1 y 24.');
    }
    setErrores(problemas);
    if (problemas.length > 0 || !importe.ok || !esFechaISO(desde)) return;
    const limpio = texto.trim();
    try {
      await onGuardar({
        espacio_id: espacioId,
        sentido,
        importe: importe.importe,
        categoria_id: categoriaId,
        naturaleza: fijo ? 'fijo' : 'variable',
        comercio: sentido === 'salida' && limpio ? limpio : null,
        concepto: sentido === 'entrada' && limpio ? limpio : null,
        frecuencia,
        cada_n: frecuencia === 'cada_n_meses' ? n : 1,
        desde,
        hasta: hasta && esFechaISO(hasta) ? hasta : null,
      });
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se ha podido guardar.']);
    }
  }

  return (
    <>
      <form class="formulario" onSubmit={(e) => void enviar(e)} noValidate>
        <fieldset class="segmentado">
          <legend class="solo-lectores">Tipo</legend>
          {(['salida', 'entrada'] as const).map((s) => (
            <label key={s} class={sentido === s ? 'activo' : undefined}>
              <input type="radio" name="sentido" value={s} checked={sentido === s} onChange={() => setSentido(s)} />
              {s === 'salida' ? 'Gasto' : 'Ingreso'}
            </label>
          ))}
        </fieldset>
        <label class="campo campo--importe">
          <span>Importe (€)</span>
          <input
            ref={campoImporte}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={importeTexto}
            onInput={(e) => setImporteTexto(e.currentTarget.value)}
          />
        </label>
        <label class="campo">
          <span>{sentido === 'salida' ? 'Comercio' : 'Concepto'}</span>
          <input type="text" maxLength={80} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
        </label>
        <label class="campo">
          <span>Categoría</span>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.currentTarget.value)}>
            <option value="">Elige una categoría</option>
            {delSentido.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <div class="fila-campos">
          <label class="campo">
            <span>Frecuencia</span>
            <select value={frecuencia} onChange={(e) => setFrecuencia(e.currentTarget.value as Frecuencia)}>
              <option value="mensual">Cada mes</option>
              <option value="trimestral">Cada 3 meses</option>
              <option value="anual">Cada año</option>
              <option value="cada_n_meses">Cada N meses</option>
            </select>
          </label>
          {frecuencia === 'cada_n_meses' && (
            <label class="campo">
              <span>Cada cuántos meses</span>
              <input type="number" min={1} max={24} inputMode="numeric" value={cadaN} onInput={(e) => setCadaN(e.currentTarget.value)} />
            </label>
          )}
        </div>
        <div class="fila-campos fila-campos--iguales">
          <label class="campo">
            <span>Primera vez</span>
            <input type="date" value={desde} onInput={(e) => setDesde(e.currentTarget.value)} />
          </label>
          <label class="campo">
            <span>Hasta (opcional)</span>
            <input type="date" value={hasta} onInput={(e) => setHasta(e.currentTarget.value)} />
          </label>
        </div>
        <label class="casilla">
          <input type="checkbox" checked={fijo} onChange={(e) => setFijo(e.currentTarget.checked)} />
          <span>{sentido === 'salida' ? 'Gasto fijo' : 'Ingreso fijo'}</span>
        </label>
        <ListaErrores errores={errores} />
        <button class="boton boton--principal" type="submit">
          Guardar
        </button>
      </form>

      {onBorrar && (
        <div class="zona-peligro">
          {!confirmandoBorrado ? (
            <button class="boton boton--peligro" type="button" onClick={() => setConfirmandoBorrado(true)}>
              Borrar recurrente
            </button>
          ) : (
            <div role="group" aria-label="Confirmar borrado">
              <p>Se dejará de proponer cada mes. Los movimientos ya confirmados se conservan.</p>
              <button class="boton boton--peligro" type="button" onClick={() => void onBorrar()}>
                Sí, borrar
              </button>{' '}
              <button class="boton" type="button" onClick={() => setConfirmandoBorrado(false)}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
