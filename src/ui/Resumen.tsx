import { useEffect, useState } from 'preact/hooks';
import { listarMovimientosDelMes, type Movimiento } from '../datos/repos/movimientos';
import { obtenerNomina } from '../datos/repos/nomina';
import { listarRecurrencias, ocurrenciasConfirmadas } from '../datos/repos/recurrencias';
import { useEspacios } from '../espacios/estado';
import type { ConfigNomina } from '../movimientos/nomina';
import { useCategorias } from '../movimientos/Nuevo';
import { pendientesDelMes } from '../movimientos/recurrencias';
import { resumenDelMes, type CategoriaBasica, type LineaCategoria, type Vista } from '../movimientos/resumen';
import type { MovimientoBasico } from '../movimientos/calculos';
import { categoriaComun, misPartes } from '../comun/miParte';
import { idUsuarioActual } from '../datos/repos/espacios';
import { AvisosResumen } from '../cartera/AvisosResumen';
import { centimos } from '../nucleo/dinero';
import { claveMes, hoy, sumarMeses, type ClaveMes } from '../nucleo/fechas';
import { formatearEUR, formatearEURConSigno, formatearPorcentaje } from '../nucleo/formato';
import { nombreMes } from '../nucleo/textos';

/** Resumen del mes del espacio seleccionado (SPEC §4.4, F3, F7). */
export function Resumen() {
  const { actual, espacios } = useEspacios();
  const { categorias } = useCategorias(actual?.id);
  const [mes, setMes] = useState<ClaveMes>(() => claveMes(hoy()));
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [comunes, setComunes] = useState<{ movimientos: MovimientoBasico[]; categorias: CategoriaBasica[] }>({
    movimientos: [],
    categorias: [],
  });
  const [nomina, setNomina] = useState<ConfigNomina | null>(null);
  const [vista, setVista] = useState<Vista>('caja');
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState('');
  const esIndividual = actual?.tipo === 'individual';

  useEffect(() => {
    if (!actual) return;
    setMovimientos(null);
    setError('');
    listarMovimientosDelMes(actual.id, mes).then(setMovimientos, (e: Error) => setError(e.message));
    Promise.all([listarRecurrencias(actual.id), ocurrenciasConfirmadas(actual.id, mes)]).then(
      ([recurrencias, confirmadas]) => setPendientes(pendientesDelMes(recurrencias, mes, confirmadas).length),
      () => setPendientes(0),
    );
  }, [actual?.id, mes]);

  useEffect(() => {
    if (esIndividual) obtenerNomina().then(setNomina, () => setNomina(null));
    else setNomina(null);
  }, [esIndividual]);

  // En «Yo», mi parte de los gastos comunes de cada espacio compartido (SPEC CA6.3)
  const compartidos = espacios.filter((e) => e.tipo === 'compartido');
  const claveCompartidos = compartidos.map((e) => e.id).join(',');
  useEffect(() => {
    setComunes({ movimientos: [], categorias: [] });
    if (!esIndividual || compartidos.length === 0) return;
    let vigente = true;
    void (async () => {
      const yo = await idUsuarioActual();
      if (!yo) return;
      const listas = await Promise.all(compartidos.map((e) => listarMovimientosDelMes(e.id, mes)));
      if (!vigente) return;
      setComunes({
        movimientos: compartidos.flatMap((e, i) => misPartes(listas[i] ?? [], yo, e.id)),
        categorias: compartidos.flatMap((e) => [categoriaComun(e.id, e.nombre, 'salida'), categoriaComun(e.id, e.nombre, 'entrada')]),
      });
    })().catch(() => vigente && setComunes({ movimientos: [], categorias: [] }));
    return () => {
      vigente = false;
    };
  }, [esIndividual, claveCompartidos, mes]);

  if (error) return <p class="error" role="alert">{error}</p>;
  if (!actual || !movimientos || !categorias) return <p class="cargando">Cargando…</p>;

  const puedeProrratear = esIndividual && nomina?.pagas === 14;
  const r = resumenDelMes([...movimientos, ...comunes.movimientos], [...categorias, ...comunes.categorias], {
    vista: puedeProrratear ? vista : 'caja',
    nomina,
  });
  const esMesActual = mes === claveMes(hoy());

  return (
    <section>
      <h1>Resumen · {actual.nombre}</h1>

      <nav class="selector-mes" aria-label="Mes">
        <button class="boton-icono" type="button" aria-label="Mes anterior" onClick={() => setMes(sumarMeses(mes, -1))}>
          ‹
        </button>
        <h2 aria-live="polite">{nombreMes(mes)}</h2>
        <button class="boton-icono" type="button" aria-label="Mes siguiente" disabled={esMesActual} onClick={() => setMes(sumarMeses(mes, 1))}>
          ›
        </button>
      </nav>

      {puedeProrratear && (
        <fieldset class="segmentado">
          <legend class="solo-lectores">Vista</legend>
          <label class={vista === 'caja' ? 'activo' : undefined}>
            <input type="radio" name="vista" checked={vista === 'caja'} onChange={() => setVista('caja')} />
            Caja real
          </label>
          <label class={vista === 'prorrateada' ? 'activo' : undefined}>
            <input type="radio" name="vista" checked={vista === 'prorrateada'} onChange={() => setVista('prorrateada')} />
            Prorrateada
          </label>
        </fieldset>
      )}

      <div class="tarjeta bloque disponible">
        <p class="disponible__titulo">Disponible para ahorrar o invertir</p>
        <p class={`disponible__importe importe importe--${r.disponible < 0 ? 'salida' : 'entrada'}`} data-testid="disponible">
          {formatearEURConSigno(r.disponible)}
        </p>
        <dl class="totales">
          <div>
            <dt>Entradas</dt>
            <dd class="importe importe--entrada" data-testid="entradas">
              {formatearEURConSigno(r.entradas)}
            </dd>
          </div>
          <div>
            <dt>Salidas fijas</dt>
            <dd class="importe importe--salida">{formatearEURConSigno(centimos(0 - r.salidasFijas))}</dd>
          </div>
          <div>
            <dt>Salidas variables</dt>
            <dd class="importe importe--salida">{formatearEURConSigno(centimos(0 - r.salidasVariables))}</dd>
          </div>
        </dl>
        {r.nominaSustituida && (
          <p class="nota" data-testid="nota-prorrateo">
            Vista prorrateada: tus apuntes de «Nómina» ({formatearEUR(r.nominaSustituida.apuntada)}) se sustituyen por el
            mensual equivalente de 14 pagas ({formatearEUR(r.nominaSustituida.prorrateada)}).
          </p>
        )}
      </div>

      {pendientes > 0 && (
        <p class="aviso">
          Tienes {pendientes} {pendientes === 1 ? 'recurrente pendiente' : 'recurrentes pendientes'} de confirmar este mes.{' '}
          <a href="#/movimientos">Revisar</a>
        </p>
      )}

      {esIndividual && <AvisosResumen />}

      {esIndividual && !nomina && (
        <p class="nota">
          ¿Cobras 14 pagas? <a href="#/ajustes/nomina">Configura tu nómina</a> para ver el mes prorrateado.
        </p>
      )}

      <Desglose titulo="Salidas por categoría" lineas={r.salidasPorCategoria} sentido="salida" />
      <Desglose titulo="Entradas por categoría" lineas={r.entradasPorCategoria} sentido="entrada" />

      <p>
        <a href="#/resumen/historico">Ver histórico</a>
      </p>
    </section>
  );
}

function Desglose({ titulo, lineas, sentido }: { titulo: string; lineas: LineaCategoria[]; sentido: 'entrada' | 'salida' }) {
  if (lineas.length === 0) return null;
  return (
    <section class="tarjeta bloque" aria-label={titulo}>
      <h2>{titulo}</h2>
      <ul class="desglose">
        {lineas.map((l) => (
          <li key={l.categoriaId}>
            <span class="desglose__fila">
              <span>{l.nombre}</span>
              <span class="importe">
                {formatearEUR(l.importe)} <span class="nota">({formatearPorcentaje(l.peso)})</span>
              </span>
            </span>
            <span class={`barra barra--${sentido}`} aria-hidden="true">
              <span class={`barra__relleno ancho-${Math.round(l.peso * 20) * 5}`} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
