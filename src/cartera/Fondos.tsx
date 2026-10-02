import { useEffect, useState } from 'preact/hooks';
import {
  borrarAportacion,
  borrarFondo,
  borrarValoracion,
  crearAportacion,
  guardarFondo,
  guardarValoracion,
  listarFondos,
  movimientosCartera,
  obtenerFondo,
  type AportacionGuardada,
  type Fondo,
  type ValoracionGuardada,
} from '../datos/repos/cartera';
import { centimos, parsearImporte } from '../nucleo/dinero';
import { esFechaISO, hoy } from '../nucleo/fechas';
import { formatearEUR, formatearEURConSigno, formatearPorcentaje } from '../nucleo/formato';
import { nombreDia } from '../nucleo/textos';
import { Barras } from '../ui/graficos/Barras';
import { ListaErrores } from '../ui/ListaErrores';
import { navegar } from '../ui/router';
import { evolucion, indicadores, type Indicadores } from './cartera';
import { esIsinValido, normalizarIsin } from './isin';

const EJE = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
const FECHA_CORTA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' });

function porcentaje(valor: number | null): string {
  return valor === null ? '—' : formatearPorcentaje(valor);
}

/** Datos que se repiten en la lista y en el detalle (SPEC §4.8). */
function Indicadores({ i, ter }: { i: Indicadores; ter: number }) {
  return (
    <dl class="datos datos--tres">
      <div>
        <dt>Aportado</dt>
        <dd class="importe">{formatearEUR(i.aportado)}</dd>
      </div>
      <div>
        <dt>Valor actual</dt>
        <dd class="importe">{i.valorActual === null ? 'Sin valorar' : formatearEUR(i.valorActual)}</dd>
      </div>
      <div>
        <dt>Plusvalía</dt>
        <dd class="importe">{i.plusvalia === null ? '—' : formatearEURConSigno(i.plusvalia)}</dd>
      </div>
      <div>
        <dt>Rentabilidad</dt>
        <dd>{porcentaje(i.rentabilidadSimple)}</dd>
      </div>
      <div>
        <dt>TIR anual</dt>
        <dd>{porcentaje(i.tir)}</dd>
      </div>
      <div>
        <dt>Coste TER ({String(ter).replace('.', ',')} %)</dt>
        <dd>{i.costeAnualTer === null ? '—' : `${formatearEUR(i.costeAnualTer)}/año`}</dd>
      </div>
    </dl>
  );
}

/** #/fondos: la cartera con sus totales (SPEC F8). */
export function ListaFondos() {
  const [datos, setDatos] = useState<{ fondos: Fondo[]; aportaciones: AportacionGuardada[]; valoraciones: ValoracionGuardada[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listarFondos(), movimientosCartera()]).then(
      ([fondos, m]) => setDatos({ fondos, ...m }),
      (e: Error) => setError(e.message),
    );
  }, []);

  if (error) return <p class="error" role="alert">{error}</p>;
  if (!datos) return <p class="cargando">Cargando…</p>;

  const porFondo = datos.fondos.map((f) => ({
    fondo: f,
    i: indicadores(
      datos.aportaciones.filter((a) => a.fondo_id === f.id),
      datos.valoraciones.filter((v) => v.fondo_id === f.id),
      f.ter,
    ),
  }));
  const total = indicadores(
    datos.aportaciones.filter((a) => {
      const fecha = porFondo.find((p) => p.fondo.id === a.fondo_id)?.i.fechaValor;
      return fecha ? a.fecha <= fecha : false;
    }),
    [],
    0,
  );
  const valorTotal = porFondo.reduce((t, p) => t + (p.i.valorActual ?? 0), 0);
  const aportadoValorado = total.aportado;

  return (
    <section>
      <div class="titulo-con-accion">
        <h1>Fondos</h1>
        <a href="#/fondos/nuevo">Añadir fondo</a>
      </div>
      <p class="nota">Solo tú ves tu cartera. El valor lo actualizas tú cuando quieras.</p>

      {datos.fondos.length === 0 ? (
        <p class="vacio">
          Aún no tienes fondos. <a href="#/fondos/nuevo">Añade el primero</a>.
        </p>
      ) : (
        <>
          <div class="tarjeta bloque">
            <h2>Toda la cartera</h2>
            <dl class="datos">
              <div>
                <dt>Valor actual</dt>
                <dd class="importe" data-testid="valor-cartera">
                  {formatearEUR(centimos(valorTotal))}
                </dd>
              </div>
              <div>
                <dt>Plusvalía</dt>
                <dd class="importe">{formatearEURConSigno(centimos(valorTotal - aportadoValorado))}</dd>
              </div>
            </dl>
          </div>
          <ul class="lista-enlaces">
            {porFondo.map(({ fondo, i }) => (
              <li key={fondo.id}>
                <a class="tarjeta" href={`#/fondos/${fondo.id}`}>
                  <strong>{fondo.nombre}</strong>
                  <span class="nota">
                    {fondo.isin} · {i.valorActual === null ? 'Sin valorar' : formatearEUR(i.valorActual)}
                    {i.tir === null ? '' : ` · TIR ${porcentaje(i.tir)}`}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Alta y edición de un fondo: nombre, ISIN (validado) y TER. */
export function EditarFondo({ id }: { id: string | null }) {
  const [cargado, setCargado] = useState(!id);
  const [nombre, setNombre] = useState('');
  const [isin, setIsin] = useState('');
  const [ter, setTer] = useState('');
  const [errores, setErrores] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    obtenerFondo(id).then(
      (f) => {
        if (f) {
          setNombre(f.nombre);
          setIsin(f.isin);
          setTer(String(f.ter).replace('.', ','));
        }
        setCargado(true);
      },
      (e: Error) => setErrores([e.message]),
    );
  }, [id]);

  async function enviar(e: Event) {
    e.preventDefault();
    const problemas: string[] = [];
    const codigo = normalizarIsin(isin);
    const terNumero = ter.trim() === '' ? 0 : Number(ter.replace(',', '.'));
    if (!nombre.trim()) problemas.push('Escribe el nombre del fondo.');
    if (!esIsinValido(codigo)) problemas.push('El ISIN no es válido: revisa las 12 letras y números (por ejemplo IE00B4L5Y983).');
    if (!(terNumero >= 0 && terNumero <= 5)) problemas.push('El TER debe ser un porcentaje entre 0 y 5 (por ejemplo 0,12).');
    setErrores(problemas);
    if (problemas.length > 0) return;
    try {
      const nuevoId = await guardarFondo({ nombre: nombre.trim(), isin: codigo, ter: terNumero }, id ?? undefined);
      navegar(`/fondos/${nuevoId}`);
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se ha podido guardar.']);
    }
  }

  if (!cargado) return <p class="cargando">Cargando…</p>;

  return (
    <section>
      <p>
        <a href={id ? `#/fondos/${id}` : '#/fondos'}>‹ {id ? 'Fondo' : 'Fondos'}</a>
      </p>
      <h1>{id ? 'Editar fondo' : 'Añadir fondo'}</h1>
      <form class="formulario" onSubmit={(e) => void enviar(e)} noValidate>
        <label class="campo">
          <span>Nombre</span>
          <input type="text" maxLength={80} value={nombre} onInput={(e) => setNombre(e.currentTarget.value)} placeholder="Ej.: MSCI World" />
        </label>
        <div class="fila-campos fila-campos--iguales">
          <label class="campo">
            <span>ISIN</span>
            <input type="text" autoComplete="off" autoCapitalize="characters" maxLength={14} value={isin} onInput={(e) => setIsin(e.currentTarget.value)} />
          </label>
          <label class="campo">
            <span>TER (%)</span>
            <input type="text" inputMode="decimal" value={ter} onInput={(e) => setTer(e.currentTarget.value)} placeholder="0,12" />
          </label>
        </div>
        <ListaErrores errores={errores} />
        <button class="boton boton--principal" type="submit">
          Guardar fondo
        </button>
      </form>
    </section>
  );
}

/** #/fondos/:id: indicadores, gráfico de valor frente a aportado, aportaciones y valoraciones. */
export function DetalleFondo({ id }: { id: string }) {
  const [fondo, setFondo] = useState<Fondo | null | undefined>(undefined);
  const [m, setM] = useState<{ aportaciones: AportacionGuardada[]; valoraciones: ValoracionGuardada[] } | null>(null);
  const [error, setError] = useState('');
  const [recargas, setRecargas] = useState(0);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  useEffect(() => {
    Promise.all([obtenerFondo(id), movimientosCartera(id)]).then(
      ([f, movs]) => {
        setFondo(f);
        setM(movs);
      },
      (e: Error) => setError(e.message),
    );
  }, [id, recargas]);

  if (error) return <p class="error" role="alert">{error}</p>;
  if (fondo === null) {
    return (
      <section>
        <h1>Fondo no encontrado</h1>
        <p>
          <a href="#/fondos">Volver a fondos</a>
        </p>
      </section>
    );
  }
  if (!fondo || !m) return <p class="cargando">Cargando…</p>;

  const i = indicadores(m.aportaciones, m.valoraciones, fondo.ter);
  const serie = evolucion(m.aportaciones, m.valoraciones);
  const recargar = () => setRecargas((n) => n + 1);

  return (
    <section>
      <p>
        <a href="#/fondos">‹ Fondos</a>
      </p>
      <div class="titulo-con-accion">
        <h1 id="titulo-fondo">{fondo.nombre}</h1>
        <a href={`#/fondos/${id}/editar`}>Editar</a>
      </div>
      <p class="nota">
        {fondo.isin}
        {i.fechaValor ? ` · Valorado el ${nombreDia(i.fechaValor).toLowerCase()}` : ''}
      </p>

      <div class="tarjeta bloque">
        <Indicadores i={i} ter={fondo.ter} />
        <p class="nota">El TER ya está descontado del valor liquidativo: el coste es solo informativo.</p>
        <p>
          <a class="boton" href={`#/fondos/${id}/valorar`}>
            Actualizar valor
          </a>
        </p>
      </div>

      {serie.length > 0 && (
        <div class="tarjeta bloque">
          <h2>Evolución</h2>
          <ul class="leyenda" aria-label="Leyenda">
            <li>
              <span class="muestra serie-entradas" aria-hidden="true" /> Aportado
            </li>
            <li>
              <span class="muestra serie-salidas" aria-hidden="true" /> Valor
            </li>
          </ul>
          <Barras
            idTitulo="titulo-fondo"
            grupos={serie.map((s) => ({
              clave: s.fecha,
              etiqueta: FECHA_CORTA.format(new Date(`${s.fecha}T00:00:00Z`)),
              descripcion: `${nombreDia(s.fecha)}: aportado ${formatearEUR(s.aportado)}, valor ${formatearEUR(s.valor)}`,
              valores: [s.aportado, s.valor],
            }))}
            clases={['serie-entradas', 'serie-salidas']}
            formatoEje={(c) => EJE.format(c / 100)}
            seleccionado={seleccionado}
            onSeleccionar={setSeleccionado}
          />
          <div class="tabla-desplazable" role="region" aria-label="Tabla de la evolución" tabIndex={0}>
            <table class="tabla">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Aportado</th>
                  <th scope="col">Valor</th>
                </tr>
              </thead>
              <tbody>
                {[...serie].reverse().map((s) => (
                  <tr key={s.fecha}>
                    <th scope="row">{nombreDia(s.fecha)}</th>
                    <td>{formatearEUR(s.aportado)}</td>
                    <td>{formatearEUR(s.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NuevaAportacion fondoId={id} onGuardada={recargar} />

      <section class="tarjeta bloque" aria-labelledby="titulo-aportaciones">
        <h2 id="titulo-aportaciones">Aportaciones</h2>
        {m.aportaciones.length === 0 && <p class="nota">Aún no hay aportaciones.</p>}
        <ul class="lista-simple">
          {m.aportaciones.map((a) => (
            <li key={a.id}>
              <span>
                {formatearEUR(a.importe)} <span class="nota">· {nombreDia(a.fecha)}</span>
              </span>
              <button class="boton-enlace" type="button" aria-label={`Borrar aportación de ${formatearEUR(a.importe)}`} onClick={() => void borrarAportacion(a.id).then(recargar)}>
                Borrar
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section class="tarjeta bloque" aria-labelledby="titulo-valoraciones">
        <h2 id="titulo-valoraciones">Valores apuntados</h2>
        {m.valoraciones.length === 0 && <p class="nota">Aún no has apuntado el valor de este fondo.</p>}
        <ul class="lista-simple">
          {m.valoraciones.map((v) => (
            <li key={v.id}>
              <span>
                {formatearEUR(v.valor)} <span class="nota">· {nombreDia(v.fecha)}</span>
              </span>
              <button class="boton-enlace" type="button" aria-label={`Borrar valor de ${formatearEUR(v.valor)}`} onClick={() => void borrarValoracion(v.id).then(recargar)}>
                Borrar
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div class="zona-peligro">
        {!confirmandoBorrado ? (
          <button class="boton boton--peligro" type="button" onClick={() => setConfirmandoBorrado(true)}>
            Borrar fondo
          </button>
        ) : (
          <div role="group" aria-label="Confirmar borrado">
            <p>Se borrarán también sus aportaciones y valores. No se puede deshacer.</p>
            <button class="boton boton--peligro" type="button" onClick={() => void borrarFondo(id).then(() => navegar('/fondos'))}>
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

function NuevaAportacion({ fondoId, onGuardada }: { fondoId: string; onGuardada: () => void }) {
  const [importe, setImporte] = useState('');
  const [fecha, setFecha] = useState<string>(hoy());
  const [participaciones, setParticipaciones] = useState('');
  const [errores, setErrores] = useState<string[]>([]);

  async function enviar(e: Event) {
    e.preventDefault();
    const i = parsearImporte(importe);
    const p = participaciones.trim() === '' ? null : Number(participaciones.replace(',', '.'));
    const problemas: string[] = [];
    if (!i.ok || i.importe <= 0) problemas.push('Escribe el importe aportado.');
    if (!esFechaISO(fecha)) problemas.push('La fecha no es válida.');
    if (p !== null && !(p > 0)) problemas.push('Las participaciones deben ser un número mayor que cero.');
    setErrores(problemas);
    if (problemas.length > 0 || !i.ok || !esFechaISO(fecha)) return;
    try {
      await crearAportacion({ fondo_id: fondoId, fecha, importe: i.importe, participaciones: p });
      setImporte('');
      setParticipaciones('');
      onGuardada();
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se ha podido guardar.']);
    }
  }

  return (
    <form class="tarjeta bloque formulario" onSubmit={(e) => void enviar(e)} noValidate aria-labelledby="titulo-nueva-aportacion">
      <h2 id="titulo-nueva-aportacion">Nueva aportación</h2>
      <div class="fila-campos fila-campos--iguales">
        <label class="campo">
          <span>Importe aportado (€)</span>
          <input type="text" inputMode="decimal" value={importe} onInput={(e) => setImporte(e.currentTarget.value)} />
        </label>
        <label class="campo">
          <span>Fecha de la aportación</span>
          <input type="date" value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} />
        </label>
      </div>
      <label class="campo">
        <span>Participaciones (opcional)</span>
        <input type="text" inputMode="decimal" value={participaciones} onInput={(e) => setParticipaciones(e.currentTarget.value)} />
      </label>
      <ListaErrores errores={errores} />
      <button class="boton" type="submit">
        Añadir aportación
      </button>
    </form>
  );
}

/** #/fondos/:id/valorar: apuntar el valor total de la posición (SPEC §4.8). */
export function ValorarFondo({ id }: { id: string }) {
  const [fondo, setFondo] = useState<Fondo | null | undefined>(undefined);
  const [valor, setValor] = useState('');
  const [fecha, setFecha] = useState<string>(hoy());
  const [errores, setErrores] = useState<string[]>([]);

  useEffect(() => {
    obtenerFondo(id).then(setFondo, (e: Error) => setErrores([e.message]));
  }, [id]);

  async function enviar(e: Event) {
    e.preventDefault();
    const v = parsearImporte(valor);
    const problemas: string[] = [];
    if (!v.ok || v.importe < 0) problemas.push('Escribe el valor total de tu posición en el fondo.');
    if (!esFechaISO(fecha)) problemas.push('La fecha no es válida.');
    setErrores(problemas);
    if (problemas.length > 0 || !v.ok || !esFechaISO(fecha)) return;
    try {
      await guardarValoracion({ fondo_id: id, fecha, valor: v.importe });
      navegar(`/fondos/${id}`);
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se ha podido guardar.']);
    }
  }

  if (fondo === undefined && errores.length === 0) return <p class="cargando">Cargando…</p>;

  return (
    <section>
      <p>
        <a href={`#/fondos/${id}`}>‹ {fondo?.nombre ?? 'Fondo'}</a>
      </p>
      <h1>Actualizar valor</h1>
      <p class="nota">El valor total de tu posición en {fondo?.nombre ?? 'el fondo'}, tal como lo ves en tu banco o bróker.</p>
      <form class="formulario" onSubmit={(e) => void enviar(e)} noValidate>
        <div class="fila-campos fila-campos--iguales">
          <label class="campo">
            <span>Valor actual (€)</span>
            <input type="text" inputMode="decimal" value={valor} onInput={(e) => setValor(e.currentTarget.value)} />
          </label>
          <label class="campo">
            <span>Fecha del valor</span>
            <input type="date" value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} />
          </label>
        </div>
        <ListaErrores errores={errores} />
        <button class="boton boton--principal" type="submit">
          Guardar valor
        </button>
      </form>
    </section>
  );
}
