import { useEffect, useMemo, useState } from 'preact/hooks';
import { listarMovimientosDelMes, type Movimiento } from '../datos/repos/movimientos';
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

  useEffect(() => {
    if (!actual) return;
    setMovimientos(null);
    setError('');
    listarMovimientosDelMes(actual.id, mes).then(setMovimientos, (e: Error) => setError(e.message));
  }, [actual?.id, mes]);

  const nombreCategoria = useMemo(() => new Map((categorias ?? []).map((c) => [c.id, c.nombre])), [categorias]);
  const visibles = movimientos ? filtrar(movimientos, filtro) : [];
  const resumen = totales(visibles);
  const esMesActual = mes === claveMes(hoy());

  return (
    <section>
      <h1>Movimientos</h1>

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
