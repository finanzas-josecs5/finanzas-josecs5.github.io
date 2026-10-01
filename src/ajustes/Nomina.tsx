import { useEffect, useState } from 'preact/hooks';
import { listarCategorias } from '../datos/repos/movimientos';
import { guardarNomina, obtenerNomina } from '../datos/repos/nomina';
import { crearRecurrencia, listarRecurrencias } from '../datos/repos/recurrencias';
import { useEspacios } from '../espacios/estado';
import { netoAnual, prorrateoMensual, type ConfigNomina } from '../movimientos/nomina';
import { esCategoriaNomina } from '../movimientos/resumen';
import { CERO, parsearImporte, textoEditable } from '../nucleo/dinero';
import { fechaISO, hoy, ultimoDiaDelMes, type ClaveMes } from '../nucleo/fechas';
import { formatearEUR } from '../nucleo/formato';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Ajustes → Nómina: 12 o 14 pagas, netos y prorrateo (SPEC F3). */
export function AjustesNomina() {
  const { espacios } = useEspacios();
  const individual = espacios.find((e) => e.tipo === 'individual');
  const [cargada, setCargada] = useState(false);
  const [pagas, setPagas] = useState<12 | 14>(14);
  const [ordinario, setOrdinario] = useState('');
  const [extra, setExtra] = useState('');
  const [mesesExtra, setMesesExtra] = useState<[number, number]>([6, 12]);
  const [guardada, setGuardada] = useState<ConfigNomina | null>(null);
  const [diaCobro, setDiaCobro] = useState('28');
  const [mensaje, setMensaje] = useState('');
  const [errores, setErrores] = useState<string[]>([]);

  useEffect(() => {
    obtenerNomina().then(
      (n) => {
        if (n) {
          setGuardada(n);
          setPagas(n.pagas);
          setOrdinario(textoEditable(n.neto_ordinario));
          setExtra(n.neto_extra ? textoEditable(n.neto_extra) : '');
          setMesesExtra([n.meses_extra[0] ?? 6, n.meses_extra[1] ?? 12]);
        }
        setCargada(true);
      },
      (e: Error) => setErrores([e.message]),
    );
  }, []);

  async function guardar(e: Event) {
    e.preventDefault();
    setMensaje('');
    const problemas: string[] = [];
    const o = parsearImporte(ordinario);
    const x = pagas === 14 ? parsearImporte(extra || ordinario) : null;
    if (!o.ok || o.importe <= 0) problemas.push('Escribe el neto mensual ordinario (por ejemplo 2.000).');
    if (x && (!x.ok || x.importe < 0)) problemas.push('El neto de la paga extra no es válido.');
    if (pagas === 14 && mesesExtra[0] === mesesExtra[1]) problemas.push('Las dos pagas extra deben caer en meses distintos.');
    setErrores(problemas);
    if (problemas.length > 0 || !o.ok) return;
    const datos: ConfigNomina = {
      pagas,
      neto_ordinario: o.importe,
      // Con 12 pagas no hay extras; con 14, si se deja vacío, la extra es igual que la ordinaria
      neto_extra: pagas === 12 ? CERO : x?.ok ? x.importe : o.importe,
      meses_extra: [...mesesExtra].sort((a, b) => a - b),
    };
    try {
      await guardarNomina(datos);
      setGuardada(datos);
      setMensaje('Nómina guardada.');
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se ha podido guardar.']);
    }
  }

  /** Crea los recurrentes de la nómina en el espacio «Yo» para confirmarlos cada mes (CA4.4). */
  async function crearRecurrentes() {
    setMensaje('');
    if (!guardada || !individual) return;
    const dia = Number(diaCobro);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      setErrores(['El día de cobro debe estar entre 1 y 31.']);
      return;
    }
    try {
      const categorias = await listarCategorias(individual.id);
      const nomina = categorias.find(esCategoriaNomina);
      if (!nomina) throw new Error('No se encuentra la categoría «Nómina» en tu espacio.');
      const existentes = await listarRecurrencias(individual.id);
      if (existentes.some((r) => r.categoria_id === nomina.id)) {
        setErrores(['Ya tienes recurrentes de nómina. Puedes revisarlos en Movimientos → Recurrentes.']);
        return;
      }
      const hoyISO = hoy();
      const anio = Number(hoyISO.slice(0, 4));
      const desdeMes = (mes: number) => {
        const clave = `${anio}-${String(mes).padStart(2, '0')}` as ClaveMes;
        return fechaISO(anio, mes, Math.min(dia, ultimoDiaDelMes(clave)));
      };
      const mesActual = Number(hoyISO.slice(5, 7));
      const base = { espacio_id: individual.id, sentido: 'entrada' as const, categoria_id: nomina.id, naturaleza: 'fijo' as const, comercio: null, hasta: null, cada_n: 1 };
      await crearRecurrencia({ ...base, importe: guardada.neto_ordinario, concepto: 'Nómina', frecuencia: 'mensual', desde: desdeMes(mesActual) });
      if (guardada.pagas === 14) {
        for (const mes of guardada.meses_extra) {
          await crearRecurrencia({
            ...base,
            importe: guardada.neto_extra,
            concepto: `Paga extra de ${MESES[mes - 1] ?? ''}`,
            frecuencia: 'anual',
            desde: desdeMes(mes),
          });
        }
      }
      setErrores([]);
      setMensaje('Recurrentes creados. Cada mes aparecerán en Movimientos para confirmarlos.');
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se han podido crear los recurrentes.']);
    }
  }

  if (!cargada && errores.length === 0) return <p class="cargando">Cargando…</p>;

  return (
    <section>
      <p>
        <a href="#/ajustes">‹ Ajustes</a>
      </p>
      <h1>Nómina</h1>
      <p class="nota">Solo tú ves estos datos. Importes netos, tal como los cobras.</p>

      <form class="formulario tarjeta bloque" onSubmit={(e) => void guardar(e)} noValidate>
        <fieldset class="segmentado">
          <legend class="solo-lectores">Número de pagas</legend>
          {([12, 14] as const).map((p) => (
            <label key={p} class={pagas === p ? 'activo' : undefined}>
              <input type="radio" name="pagas" checked={pagas === p} onChange={() => setPagas(p)} />
              {p} pagas
            </label>
          ))}
        </fieldset>
        <label class="campo">
          <span>Neto mensual ordinario (€)</span>
          <input type="text" inputMode="decimal" value={ordinario} onInput={(e) => setOrdinario(e.currentTarget.value)} />
        </label>
        {pagas === 14 && (
          <>
            <label class="campo">
              <span>Neto de cada paga extra (€)</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Igual que la ordinaria"
                value={extra}
                onInput={(e) => setExtra(e.currentTarget.value)}
              />
            </label>
            <div class="fila-campos fila-campos--iguales">
              {[0, 1].map((i) => (
                <label key={i} class="campo">
                  <span>{i === 0 ? 'Primera paga extra' : 'Segunda paga extra'}</span>
                  <select
                    value={mesesExtra[i]}
                    onChange={(e) => {
                      const nuevos: [number, number] = [...mesesExtra];
                      nuevos[i] = Number(e.currentTarget.value);
                      setMesesExtra(nuevos);
                    }}
                  >
                    {MESES.map((m, n) => (
                      <option key={m} value={n + 1}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </>
        )}
        {errores.length > 0 && (
          <ul class="error" role="alert">
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {mensaje && (
          <p class="aviso" role="status">
            {mensaje}
          </p>
        )}
        <button class="boton boton--principal" type="submit">
          Guardar nómina
        </button>
      </form>

      {guardada && (
        <div class="tarjeta bloque">
          <h2>Cálculo</h2>
          <dl class="datos">
            <div>
              <dt>Mensual prorrateado</dt>
              <dd class="importe">{formatearEUR(prorrateoMensual(guardada))}</dd>
            </div>
            <div>
              <dt>Neto anual</dt>
              <dd class="importe">{formatearEUR(netoAnual(guardada))}</dd>
            </div>
          </dl>
          <p class="nota">
            Prorrateo = (12 × {formatearEUR(guardada.neto_ordinario)}
            {guardada.pagas === 14 ? ` + 2 × ${formatearEUR(guardada.neto_extra)}` : ''}) ÷ 12
          </p>

          <h2>Recurrentes de nómina</h2>
          <p class="nota">Crea la nómina{guardada.pagas === 14 ? ' y las dos pagas extra' : ''} como recurrentes para confirmarlas cada mes con un toque.</p>
          <label class="campo">
            <span>Día de cobro</span>
            <input type="number" min={1} max={31} inputMode="numeric" value={diaCobro} onInput={(e) => setDiaCobro(e.currentTarget.value)} />
          </label>
          <button class="boton" type="button" onClick={() => void crearRecurrentes()}>
            Crear recurrentes de nómina
          </button>
        </div>
      )}
    </section>
  );
}
