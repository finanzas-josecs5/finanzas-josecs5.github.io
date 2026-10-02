import { useEffect, useMemo, useState } from 'preact/hooks';
import { crearMovimiento, listarMovimientosDelMes, type Movimiento } from '../datos/repos/movimientos';
import { listarRecurrencias, ocurrenciasConfirmadas } from '../datos/repos/recurrencias';
import { pendientesDelMes, type Pendiente, type Recurrencia } from './recurrencias';
import { useEspacios } from '../espacios/estado';
import { centimos } from '../nucleo/dinero';
import { claveMes, hoy, sumarMeses, type ClaveMes } from '../nucleo/fechas';
import { formatearEUR, formatearEURConSigno } from '../nucleo/formato';
import { nombreDia, nombreMes } from '../nucleo/textos';
import { agruparPorDia, filtrar, importeConSigno, totales, type Filtro } from './calculos';
import { useCategorias } from './Nuevo';

/** Movimientos del mes, filtrables por categoría y por fijo/variable (SPEC F4). */
export function ListaMovimientos() {
  const { actual } = useEspacios();
  const { categorias } = useCategorias(actual?.id);
  const [mes, setMes] = useState<ClaveMes>(() => claveMes(hoy()));
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<Filtro>({ categoriaId: null, naturaleza: null });
  const [pendientes, setPendientes] = useState<Pendiente<Recurrencia>[]>([]);
  const [recargas, setRecargas] = useState(0);

  useEffect(() => {
    if (!actual) return;
    setMovimientos(null);
    setError('');
    listarMovimientosDelMes(actual.id, mes).then(setMovimientos, (e: Error) => setError(e.message));
    Promise.all([listarRecurrencias(actual.id), ocurrenciasConfirmadas(actual.id, mes)]).then(
      ([recurrencias, confirmadas]) => setPendientes(pendientesDelMes(recurrencias, mes, confirmadas)),
      (e: Error) => setError(e.message),
    );
  }, [actual?.id, mes, recargas]);

  async function confirmar({ recurrencia: r, ocurrencia }: Pendiente<Recurrencia>) {
    try {
      await crearMovimiento({
        espacio_id: r.espacio_id,
        fecha: ocurrencia,
        importe: r.importe,
        sentido: r.sentido,
        categoria_id: r.categoria_id,
        naturaleza: r.naturaleza,
        comercio: r.comercio,
        concepto: r.concepto,
        recurrencia_id: r.id,
        ocurrencia,
      });
      setRecargas((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido confirmar.');
    }
  }

  const nombreCategoria = useMemo(() => new Map((categorias ?? []).map((c) => [c.id, c.nombre])), [categorias]);
  const visibles = movimientos ? filtrar(movimientos, filtro) : [];
  const resumen = totales(visibles);
  const esMesActual = mes === claveMes(hoy());

  return (
    <section>
      <div class="titulo-con-accion">
        <h1>Movimientos</h1>
        <span class="enlaces-titulo">
          <a href="#/movimientos/foto">Desde foto</a>
          <a href="#/recurrentes">Recurrentes</a>
        </span>
      </div>

      <nav class="selector-mes" aria-label="Mes">
        <button class="boton-icono" type="button" aria-label="Mes anterior" onClick={() => setMes(sumarMeses(mes, -1))}>
          ‹
        </button>
        <h2 aria-live="polite">{nombreMes(mes)}</h2>
        <button
          class="boton-icono"
          type="button"
          aria-label="Mes siguiente"
          disabled={esMesActual}
          onClick={() => setMes(sumarMeses(mes, 1))}
        >
          ›
        </button>
      </nav>

      {pendientes.length > 0 && (
        <section class="pendientes tarjeta" aria-labelledby="titulo-pendientes">
          <h2 id="titulo-pendientes">Pendientes de confirmar</h2>
          <ul>
            {pendientes.map((p) => {
              const r = p.recurrencia;
              const nombre = r.comercio ?? r.concepto ?? nombreCategoria.get(r.categoria_id) ?? 'Recurrente';
              return (
                <li key={`${r.id}-${p.ocurrencia}`}>
                  <span class="movimiento__texto">
                    <strong>{nombre}</strong>
                    <span class="nota">{nombreDia(p.ocurrencia)}</span>
                  </span>
                  <span class={`importe importe--${r.sentido}`}>
                    {formatearEURConSigno(importeConSigno(r))}
                  </span>
                  <span class="pendientes__acciones">
                    <button class="boton" type="button" aria-label={`Confirmar ${nombre}`} onClick={() => void confirmar(p)}>
                      Confirmar
                    </button>
                    <a
                      class="boton"
                      aria-label={`Ajustar ${nombre}`}
                      href={`#/movimientos/nuevo?recurrencia=${r.id}&ocurrencia=${p.ocurrencia}`}
                    >
                      Ajustar
                    </a>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <dl class="totales tarjeta">
        <div>
          <dt>Entradas</dt>
          <dd class="importe importe--entrada">{formatearEURConSigno(resumen.entradas)}</dd>
        </div>
        <div>
          <dt>Salidas</dt>
          <dd class="importe importe--salida">{formatearEURConSigno(centimos(0 - resumen.salidas))}</dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd class="importe">{formatearEURConSigno(resumen.balance)}</dd>
        </div>
      </dl>

      <div class="filtros">
        <label class="campo">
          <span>Categoría</span>
          <select
            value={filtro.categoriaId ?? ''}
            onChange={(e) => setFiltro({ ...filtro, categoriaId: e.currentTarget.value || null })}
          >
            <option value="">Todas</option>
            {(categorias ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label class="campo">
          <span>Tipo</span>
          <select
            value={filtro.naturaleza ?? ''}
            onChange={(e) =>
              setFiltro({ ...filtro, naturaleza: (e.currentTarget.value || null) as Filtro['naturaleza'] })
            }
          >
            <option value="">Fijos y variables</option>
            <option value="fijo">Solo fijos</option>
            <option value="variable">Solo variables</option>
          </select>
        </label>
      </div>

      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      {!error && movimientos === null && <p class="cargando">Cargando…</p>}
      {movimientos !== null && visibles.length === 0 && (
        <p class="vacio">
          No hay movimientos este mes. <a href="#/movimientos/nuevo">Añade el primero</a>.
        </p>
      )}

      {agruparPorDia(visibles).map((grupo) => (
        <section key={grupo.fecha} class="dia">
          <h3 class="dia__cabecera">
            <span>{nombreDia(grupo.fecha)}</span>
            <span class="importe">{formatearEURConSigno(grupo.neto)}</span>
          </h3>
          <ul class="lista-movimientos">
            {grupo.movimientos.map((m) => (
              <li key={m.id}>
                <a href={`#/movimientos/${m.id}`}>
                  <span class="movimiento__texto">
                    <strong>{m.comercio ?? m.concepto ?? nombreCategoria.get(m.categoria_id) ?? 'Movimiento'}</strong>
                    <span class="nota">
                      {nombreCategoria.get(m.categoria_id) ?? ''}
                      {m.naturaleza === 'fijo' ? ' · Fijo' : ''}
                    </span>
                  </span>
                  <span
                    class={`importe importe--${m.sentido}`}
                    aria-label={`${m.sentido === 'entrada' ? 'Entrada' : 'Salida'} de ${formatearEUR(m.importe)}`}
                  >
                    {formatearEURConSigno(importeConSigno(m))}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
