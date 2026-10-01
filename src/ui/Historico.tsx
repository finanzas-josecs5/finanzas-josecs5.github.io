import { useEffect, useState } from 'preact/hooks';
import { listarMovimientosEntre } from '../datos/repos/movimientos';
import { useEspacios } from '../espacios/estado';
import type { MovimientoBasico } from '../movimientos/calculos';
import { mediaDeMeses, serieMensual, type MesHistorico } from '../movimientos/historico';
import { claveMes, hoy, mesesCompletosAnteriores, sumarMeses, ultimoDiaDelMes, type ClaveMes } from '../nucleo/fechas';
import { formatearEUR, formatearEURConSigno } from '../nucleo/formato';
import { nombreMes } from '../nucleo/textos';
import { Barras } from './graficos/Barras';

const MESES_VISIBLES = 12;
const EJE = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
const MES_CORTO = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' });

function etiquetaCorta(mes: ClaveMes): string {
  return MES_CORTO.format(new Date(`${mes}-01T00:00:00Z`)).replace('.', '');
}

function describir(fila: MesHistorico): string {
  return `${nombreMes(fila.mes)}: entradas ${formatearEUR(fila.entradas)}, salidas ${formatearEUR(fila.salidas)}, balance ${formatearEURConSigno(fila.balance)}`;
}

/** Histórico por meses con gráfico y tabla equivalente (SPEC §4.4, CA7.2, RWD7). */
export function Historico() {
  const { actual } = useEspacios();
  const [movimientos, setMovimientos] = useState<MovimientoBasico[] | null>(null);
  const [error, setError] = useState('');
  const hoyISO = hoy();
  const mesActual = claveMes(hoyISO);
  const meses = Array.from({ length: MESES_VISIBLES }, (_, i) => sumarMeses(mesActual, i - (MESES_VISIBLES - 1)));
  const [seleccionado, setSeleccionado] = useState<string | null>(mesActual);

  useEffect(() => {
    if (!actual) return;
    setMovimientos(null);
    const primero = meses[0] ?? mesActual;
    listarMovimientosEntre(actual.id, `${primero}-01`, `${mesActual}-${String(ultimoDiaDelMes(mesActual)).padStart(2, '0')}`).then(
      setMovimientos,
      (e: Error) => setError(e.message),
    );
  }, [actual?.id]);

  if (error) return <p class="error" role="alert">{error}</p>;
  if (!actual || !movimientos) return <p class="cargando">Cargando…</p>;

  const serie = serieMensual(movimientos, meses);
  const media3 = mediaDeMeses(serie, mesesCompletosAnteriores(hoyISO, 3));
  const media12 = mediaDeMeses(serie, mesesCompletosAnteriores(hoyISO, 12).filter((m) => meses.includes(m)));
  const filaSeleccionada = serie.find((s) => s.mes === seleccionado) ?? serie.at(-1);

  return (
    <section>
      <p>
        <a href="#/resumen">‹ Resumen</a>
      </p>
      <h1 id="titulo-historico">Histórico · {actual.nombre}</h1>
      <p class="nota">Últimos 12 meses, en caja real. Las medias solo cuentan meses completos.</p>

      <div class="tarjeta bloque">
        <ul class="leyenda" aria-label="Leyenda">
          <li>
            <span class="muestra serie-entradas" aria-hidden="true" /> Entradas
          </li>
          <li>
            <span class="muestra serie-salidas" aria-hidden="true" /> Salidas
          </li>
        </ul>
        {filaSeleccionada && (
          <p class="lectura" aria-live="polite" data-testid="lectura">
            <strong>{nombreMes(filaSeleccionada.mes)}</strong> · Entradas {formatearEUR(filaSeleccionada.entradas)} · Salidas{' '}
            {formatearEUR(filaSeleccionada.salidas)} · Balance {formatearEURConSigno(filaSeleccionada.balance)}
          </p>
        )}
        <Barras
          idTitulo="titulo-historico"
          grupos={serie.map((s) => ({
            clave: s.mes,
            etiqueta: etiquetaCorta(s.mes),
            descripcion: describir(s),
            valores: [s.entradas, s.salidas],
          }))}
          clases={['serie-entradas', 'serie-salidas']}
          formatoEje={(c) => EJE.format(c / 100)}
          seleccionado={seleccionado}
          onSeleccionar={setSeleccionado}
        />
      </div>

      <div class="tabla-desplazable tarjeta">
        <table class="tabla">
          <caption class="solo-lectores">Entradas, salidas y balance por mes</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Entradas</th>
              <th scope="col">Salidas</th>
              <th scope="col">Balance</th>
            </tr>
          </thead>
          <tbody>
            {[...serie].reverse().map((s) => (
              <tr key={s.mes}>
                <th scope="row">{nombreMes(s.mes)}</th>
                <td>{formatearEUR(s.entradas)}</td>
                <td>{formatearEUR(s.salidas)}</td>
                <td>{formatearEURConSigno(s.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {(
              [
                ['Media 3 meses', media3],
                ['Media 12 meses', media12],
              ] as const
            ).map(([nombre, m]) => (
              <tr key={nombre}>
                <th scope="row">{nombre}</th>
                {m ? (
                  <>
                    <td>{formatearEUR(m.entradas)}</td>
                    <td>{formatearEUR(m.salidas)}</td>
                    <td>{formatearEURConSigno(m.balance)}</td>
                  </>
                ) : (
                  <td colSpan={3}>Sin meses completos</td>
                )}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </section>
  );
}
