import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { guardarAjustes, obtenerAjustes } from '../datos/repos/ajustes';
import { useRuta } from '../ui/router';
import { Lineas } from '../ui/graficos/Lineas';
import { ListaErrores } from '../ui/ListaErrores';
import { FUENTE_ESCALA } from './impuestos';
import { cargarIpc, estaDesactualizado, inflacionElegida, type DatosIpc, type OrigenInflacion } from './inflacion';
import { PARAMETROS_DEFECTO, simular, type Parametros, type Resultado } from './simulacion';

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always', maximumFractionDigits: 0 });
const EUR_CENTIMOS = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const EJE = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
const MES = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DIA = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'Europe/Madrid' });

/** Campos del formulario como texto (se escriben con coma decimal) */
interface Campos {
  inicial: string;
  mensual: string;
  anios: string;
  tae: string;
  pesimista: string;
  base: string;
  optimista: string;
  ter: string;
  origenInflacion: OrigenInflacion;
  inflacionManual: string;
}

const pct = (x: number) => String(Math.round(x * 10000) / 100).replace('.', ',');
const CAMPOS_DEFECTO: Campos = {
  inicial: String(PARAMETROS_DEFECTO.inicial),
  mensual: String(PARAMETROS_DEFECTO.mensual),
  anios: String(PARAMETROS_DEFECTO.anios),
  tae: pct(PARAMETROS_DEFECTO.tae),
  pesimista: pct(PARAMETROS_DEFECTO.rentabilidades.pesimista),
  base: pct(PARAMETROS_DEFECTO.rentabilidades.base),
  optimista: pct(PARAMETROS_DEFECTO.rentabilidades.optimista),
  ter: pct(PARAMETROS_DEFECTO.ter),
  origenInflacion: 'ultimo',
  inflacionManual: '2',
};

function numero(texto: string): number {
  const limpio = texto.replace(/\s|€|%/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  return limpio === '' ? Number.NaN : Number(limpio);
}

/** Convierte los campos en parámetros válidos o devuelve los problemas (SPEC §4.9). */
export function validar(c: Campos, ipc: DatosIpc | null): { parametros: Parametros | null; problemas: string[] } {
  const problemas: string[] = [];
  const v = {
    inicial: numero(c.inicial),
    mensual: numero(c.mensual),
    anios: numero(c.anios),
    tae: numero(c.tae) / 100,
    pesimista: numero(c.pesimista) / 100,
    base: numero(c.base) / 100,
    optimista: numero(c.optimista) / 100,
    ter: numero(c.ter) / 100,
  };
  if (!(v.inicial >= 0 && v.inicial <= 10_000_000)) problemas.push('La aportación inicial debe estar entre 0 y 10.000.000 €.');
  if (!(v.mensual >= 0 && v.mensual <= 100_000)) problemas.push('La aportación mensual debe estar entre 0 y 100.000 €.');
  if (!(Number.isInteger(v.anios) && v.anios >= 1 && v.anios <= 50)) problemas.push('El plazo debe ser un número entero de años entre 1 y 50.');
  if (!(v.tae >= 0 && v.tae <= 0.2)) problemas.push('La TAE debe estar entre 0 y 20 %.');
  for (const [nombre, r] of [['pesimista', v.pesimista], ['base', v.base], ['optimista', v.optimista]] as const) {
    if (!(r >= -0.5 && r <= 0.5)) problemas.push(`La rentabilidad ${nombre} debe estar entre −50 % y 50 %.`);
  }
  if (!(v.ter >= 0 && v.ter <= 0.05)) problemas.push('El TER debe estar entre 0 y 5 %.');
  const manual = numero(c.inflacionManual) / 100;
  if (c.origenInflacion === 'manual' && !(manual >= -0.1 && manual <= 0.3)) problemas.push('La inflación manual debe estar entre −10 % y 30 %.');
  const inflacion = ipc ? inflacionElegida(ipc, c.origenInflacion, manual) : null;
  if (inflacion === null) problemas.push('No hay dato de inflación para esa opción: elige otra o escríbela a mano.');
  if (problemas.length > 0 || inflacion === null) return { parametros: null, problemas };
  return {
    parametros: {
      inicial: v.inicial,
      mensual: v.mensual,
      anios: v.anios,
      tae: v.tae,
      rentabilidades: { pesimista: v.pesimista, base: v.base, optimista: v.optimista },
      ter: v.ter,
      inflacion,
    },
    problemas,
  };
}

/** #/simulador: fondos indexados frente a una cuenta remunerada (SPEC F9, §7). */
export function Simulador() {
  const { consulta } = useRuta();
  const [campos, setCampos] = useState<Campos>(CAMPOS_DEFECTO);
  const [ipc, setIpc] = useState<DatosIpc | null>(null);
  const [cargado, setCargado] = useState(false);
  const [seleccionado, setSeleccionado] = useState(-1);
  const guardado = useRef<number | undefined>(undefined);

  useEffect(() => {
    void Promise.all([cargarIpc(), obtenerAjustes().catch(() => null)]).then(([datos, ajustes]) => {
      setIpc(datos);
      const previos = (ajustes?.simulador ?? {}) as Partial<Campos>;
      const inicialPrecargada = consulta.get('inicial');
      setCampos({ ...CAMPOS_DEFECTO, ...previos, ...(inicialPrecargada ? { inicial: inicialPrecargada } : {}) });
      setCargado(true);
    });
  }, []);

  // Los parámetros se recuerdan en tus ajustes (SPEC T22), sin bloquear la pantalla
  useEffect(() => {
    if (!cargado) return;
    window.clearTimeout(guardado.current);
    guardado.current = window.setTimeout(() => void guardarAjustes({ simulador: { ...campos } }).catch(() => undefined), 800);
    return () => window.clearTimeout(guardado.current);
  }, [campos, cargado]);

  const { parametros, problemas } = useMemo(() => validar(campos, ipc), [campos, ipc]);
  const resultado = useMemo(() => (parametros ? simular(parametros) : null), [parametros]);

  if (!cargado || !ipc) return <p class="cargando">Cargando…</p>;

  const campo = (clave: keyof Campos, etiqueta: string, sufijo: string) => (
    <label class="campo">
      <span>
        {etiqueta} ({sufijo})
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={campos[clave]}
        onInput={(e) => setCampos({ ...campos, [clave]: e.currentTarget.value })}
      />
    </label>
  );

  const periodo = MES.format(new Date(`${ipc.ultimo.periodo}-01T00:00:00Z`));
  const filas: [string, Resultado | undefined][] = resultado
    ? [
        ['Cuenta remunerada', resultado.cuenta],
        ['Fondo · pesimista', resultado.pesimista],
        ['Fondo · base', resultado.base],
        ['Fondo · optimista', resultado.optimista],
      ]
    : [];
  const indice = resultado ? (seleccionado >= 0 ? seleccionado : resultado.base.serie.length - 1) : -1;

  return (
    <section>
      <h1 id="titulo-simulador">Simulador</h1>
      <p class="nota">Aportar cada mes a fondos indexados frente a una cuenta remunerada, con impuestos e inflación.</p>

      <form class="tarjeta bloque formulario-ancho" onSubmit={(e) => e.preventDefault()} noValidate>
        <div class="rejilla-campos">
          {campo('inicial', 'Aportación inicial', '€')}
          {campo('mensual', 'Aportación mensual', '€')}
          {campo('anios', 'Plazo', 'años')}
          {campo('tae', 'TAE de la cuenta', '%')}
          {campo('pesimista', 'Fondo · pesimista', '% anual')}
          {campo('base', 'Fondo · base', '% anual')}
          {campo('optimista', 'Fondo · optimista', '% anual')}
          {campo('ter', 'TER del fondo', '%')}
        </div>

        <fieldset class="inflacion">
          <legend>Inflación</legend>
          <label class="casilla">
            <input type="radio" name="inflacion" checked={campos.origenInflacion === 'ultimo'} onChange={() => setCampos({ ...campos, origenInflacion: 'ultimo' })} />
            <span>
              Último dato INE: {String(ipc.ultimo.valor).replace('.', ',')} % ({periodo}, {ipc.ultimo.tipo.toLowerCase()})
            </span>
          </label>
          <label class="casilla">
            <input
              type="radio"
              name="inflacion"
              disabled={!ipc.media10}
              checked={campos.origenInflacion === 'media10'}
              onChange={() => setCampos({ ...campos, origenInflacion: 'media10' })}
            />
            <span>
              {ipc.media10
                ? `Media 10 años INE: ${String(ipc.media10.valor).replace('.', ',')} % (${ipc.media10.desde}–${ipc.media10.hasta}), más realista a largo plazo`
                : 'Media 10 años INE: no disponible'}
            </span>
          </label>
          <label class="casilla">
            <input type="radio" name="inflacion" checked={campos.origenInflacion === 'manual'} onChange={() => setCampos({ ...campos, origenInflacion: 'manual' })} />
            <span>Manual</span>
          </label>
          {campos.origenInflacion === 'manual' && campo('inflacionManual', 'Inflación manual', '%')}
          <p class="nota" data-testid="fuente-inflacion">
            Fuente: {ipc.fuente}, serie {ipc.serie}. Descargado el {DIA.format(new Date(ipc.obtenido))}
            {ipc.respaldo ? ' (dato de respaldo: no se pudo consultar el INE en el último despliegue)' : ''}.
          </p>
          {estaDesactualizado(ipc) && (
            <p class="aviso" role="status">
              Dato de inflación desactualizado: tiene más de 45 días. Puedes escribirla a mano.
            </p>
          )}
        </fieldset>
        <ListaErrores errores={problemas} />
      </form>

      {resultado && parametros && (
        <>
          <div class="tarjeta bloque">
            <h2>Evolución</h2>
            <ul class="leyenda" aria-label="Leyenda">
              <li>
                <span class="muestra serie-entradas" aria-hidden="true" /> Fondo (base; la zona va del pesimista al optimista)
              </li>
              <li>
                <span class="muestra serie-salidas" aria-hidden="true" /> Cuenta remunerada
              </li>
            </ul>
            <p class="lectura" aria-live="polite" data-testid="lectura-simulador">
              {indice >= 0 && (
                <>
                  <strong>Año {resultado.base.serie[indice]?.anio}</strong> · Aportado {EUR.format(resultado.base.serie[indice]?.aportado ?? 0)} · Fondo{' '}
                  {EUR.format(resultado.base.serie[indice]?.valor ?? 0)} · Cuenta {EUR.format(resultado.cuenta.serie[indice]?.valor ?? 0)}
                </>
              )}
            </p>
            <Lineas
              idTitulo="titulo-simulador"
              etiquetas={resultado.base.serie.map((s) => String(s.anio))}
              descripciones={resultado.base.serie.map(
                (s, i) =>
                  `Año ${s.anio}: aportado ${EUR.format(s.aportado)}, fondo ${EUR.format(s.valor)}, cuenta ${EUR.format(resultado.cuenta.serie[i]?.valor ?? 0)}`,
              )}
              series={[
                { clase: 'serie-entradas', valores: resultado.base.serie.map((s) => s.valor) },
                { clase: 'serie-salidas', valores: resultado.cuenta.serie.map((s) => s.valor) },
              ]}
              banda={{
                clase: 'serie-entradas',
                inferior: resultado.pesimista.serie.map((s) => s.valor),
                superior: resultado.optimista.serie.map((s) => s.valor),
              }}
              formatoEje={(v) => EJE.format(v)}
              seleccionado={indice}
              onSeleccionar={setSeleccionado}
            />
          </div>

          <div class="tarjeta bloque tabla-desplazable" role="region" aria-label="Resultado al final del plazo" tabIndex={0}>
            <h2 class="tabla__titulo">Al cabo de {parametros.anios} años</h2>
            <table class="tabla" data-testid="tabla-resultado">
              <thead>
                <tr>
                  <th scope="col">Opción</th>
                  <th scope="col">Aportado</th>
                  <th scope="col">Bruto</th>
                  <th scope="col">Impuestos</th>
                  <th scope="col">Neto</th>
                  <th scope="col">Neto en € de hoy</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(([nombre, r]) =>
                  r ? (
                    <tr key={nombre}>
                      <th scope="row">{nombre}</th>
                      <td>{EUR_CENTIMOS.format(r.aportado)}</td>
                      <td>{EUR_CENTIMOS.format(r.bruto)}</td>
                      <td>{EUR_CENTIMOS.format(r.impuestos)}</td>
                      <td>
                        <strong>{EUR_CENTIMOS.format(r.neto)}</strong>
                      </td>
                      <td>{EUR_CENTIMOS.format(r.netoReal)}</td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>

          <div class="tarjeta bloque tabla-desplazable" role="region" aria-label="Tabla año a año" tabIndex={0}>
            <h2 class="tabla__titulo">Año a año (antes del impuesto del reembolso)</h2>
            <table class="tabla">
              <thead>
                <tr>
                  <th scope="col">Año</th>
                  <th scope="col">Aportado</th>
                  <th scope="col">Cuenta</th>
                  <th scope="col">Pesimista</th>
                  <th scope="col">Base</th>
                  <th scope="col">Optimista</th>
                </tr>
              </thead>
              <tbody>
                {resultado.base.serie.map((s, i) => (
                  <tr key={s.anio}>
                    <th scope="row">{s.anio}</th>
                    <td>{EUR.format(s.aportado)}</td>
                    <td>{EUR.format(resultado.cuenta.serie[i]?.valor ?? 0)}</td>
                    <td>{EUR.format(resultado.pesimista.serie[i]?.valor ?? 0)}</td>
                    <td>{EUR.format(s.valor)}</td>
                    <td>{EUR.format(resultado.optimista.serie[i]?.valor ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div class="nota bloque">
            <p>
              <strong>Simulación orientativa. La rentabilidad pasada no garantiza la futura.</strong> Cómo se calcula: la cuenta capitaliza
              cada mes al tipo (1 + TAE)^(1/12) − 1 y sus intereses tributan cada año; el fondo crece cada mes por (1 + r)^(1/12) · (1 − TER)^(1/12)
              y solo tributa al reembolsarlo al final. Impuestos según la escala del ahorro: {FUENTE_ESCALA}.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
