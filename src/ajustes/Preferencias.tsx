import { useEffect, useState } from 'preact/hooks';
import { umbralesDe } from '../consejos/datos';
import { UMBRALES_DEFECTO, type Umbrales } from '../consejos/reglas';
import { guardarAjustes, obtenerAjustes } from '../datos/repos/ajustes';
import { ListaErrores } from '../ui/ListaErrores';

interface Campo {
  clave: keyof Umbrales;
  etiqueta: string;
  /** Se muestra en % y se guarda como fracción */
  porcentaje?: boolean;
  /** Se muestra en euros y se guarda en céntimos */
  euros?: boolean;
}

const CAMPOS: Campo[] = [
  { clave: 'tasaAhorro', etiqueta: 'Tasa de ahorro mínima (%)', porcentaje: true },
  { clave: 'mesesColchon', etiqueta: 'Colchón mínimo (meses de gastos)' },
  { clave: 'mesesExceso', etiqueta: 'Liquidez de sobra a partir de (meses)' },
  { clave: 'terMaximo', etiqueta: 'TER máximo de un indexado (%)' },
  { clave: 'subidaCategoria', etiqueta: 'Subida de una categoría para avisar (%)', porcentaje: true },
  { clave: 'mediaMinimaCategoria', etiqueta: 'Media mínima de la categoría (€)', euros: true },
  { clave: 'dias', etiqueta: 'Días para recordar saldos y valores' },
];

const mostrar = (c: Campo, v: number) => String(c.porcentaje ? Math.round(v * 10000) / 100 : c.euros ? v / 100 : v).replace('.', ',');

/** Ajustes → Preferencias: umbrales de los consejos (SPEC §7.6). */
export function Preferencias() {
  const [valores, setValores] = useState<Record<string, string> | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    void obtenerAjustes().then((a) => {
      const u = umbralesDe(a.umbrales);
      setValores(Object.fromEntries(CAMPOS.map((c) => [c.clave, mostrar(c, u[c.clave])])));
    });
  }, []);

  async function enviar(e: Event) {
    e.preventDefault();
    if (!valores) return;
    setMensaje('');
    const umbrales: Partial<Umbrales> = {};
    const problemas: string[] = [];
    for (const c of CAMPOS) {
      const n = Number((valores[c.clave] ?? '').replace(',', '.'));
      if (!(n >= 0 && n <= (c.euros ? 100000 : 1000))) problemas.push(`«${c.etiqueta}» no es válido.`);
      else umbrales[c.clave] = c.porcentaje ? n / 100 : c.euros ? Math.round(n * 100) : n;
    }
    setErrores(problemas);
    if (problemas.length > 0) return;
    await guardarAjustes({ umbrales: umbrales });
    setMensaje('Umbrales guardados.');
  }

  if (!valores) return <p class="cargando">Cargando…</p>;
  return (
    <section>
      <p>
        <a href="#/ajustes">‹ Ajustes</a>
      </p>
      <h1>Preferencias</h1>
      <p class="nota">Cuándo debe avisarte cada consejo.</p>
      <form class="formulario tarjeta bloque" onSubmit={(e) => void enviar(e)} noValidate>
        {CAMPOS.map((c) => (
          <label class="campo" key={c.clave}>
            <span>{c.etiqueta}</span>
            <input type="text" inputMode="decimal" value={valores[c.clave]} onInput={(e) => setValores({ ...valores, [c.clave]: e.currentTarget.value })} />
          </label>
        ))}
        <ListaErrores errores={errores} />
        {mensaje && (
          <p class="aviso" role="status">
            {mensaje}
          </p>
        )}
        <div class="acciones">
          <button class="boton boton--principal" type="submit">
            Guardar
          </button>
          <button
            class="boton"
            type="button"
            onClick={() => setValores(Object.fromEntries(CAMPOS.map((c) => [c.clave, mostrar(c, UMBRALES_DEFECTO[c.clave])])))}
          >
            Valores por defecto
          </button>
        </div>
      </form>
    </section>
  );
}
