import { useEffect, useRef, useState } from 'preact/hooks';
import { categoriaRecordada, type Categoria, type DatosMovimiento, type Sentido } from '../datos/repos/movimientos';
import { parsearImporte, textoEditable, type Centimos } from '../nucleo/dinero';
import { esFechaISO, hoy, type FechaISO } from '../nucleo/fechas';

export interface ValoresIniciales {
  sentido: Sentido;
  importe: Centimos | null;
  texto: string;
  categoriaId: string | null;
  fecha: FechaISO;
  fijo: boolean;
}

interface Props {
  espacioId: string;
  categorias: Categoria[];
  inicial?: ValoresIniciales | undefined;
  textoBoton: string;
  onGuardar: (datos: DatosMovimiento) => Promise<void>;
}

const VACIO: ValoresIniciales = { sentido: 'salida', importe: null, texto: '', categoriaId: null, fecha: hoy(), fijo: false };

/**
 * Alta y edición de un movimiento. Pensado para el móvil (SPEC CA4.1): el importe abre
 * el teclado numérico y la categoría se propone sola si el comercio ya es conocido.
 */
export function FormularioMovimiento({ espacioId, categorias, inicial = VACIO, textoBoton, onGuardar }: Props) {
  const [sentido, setSentido] = useState<Sentido>(inicial.sentido);
  const [importeTexto, setImporteTexto] = useState(inicial.importe === null ? '' : textoEditable(inicial.importe));
  const [texto, setTexto] = useState(inicial.texto);
  const [categoriaId, setCategoriaId] = useState(inicial.categoriaId ?? '');
  const [categoriaElegidaAMano, setCategoriaElegidaAMano] = useState(inicial.categoriaId !== null);
  const [fecha, setFecha] = useState<string>(inicial.fecha);
  const [fijo, setFijo] = useState(inicial.fijo);
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const campoImporte = useRef<HTMLInputElement>(null);

  const delSentido = categorias.filter((c) => c.sentido === sentido);

  useEffect(() => campoImporte.current?.focus(), []);

  // Si la categoría elegida no es del sentido actual, se vacía
  useEffect(() => {
    if (categoriaId && !delSentido.some((c) => c.id === categoriaId)) setCategoriaId('');
  }, [sentido]);

  // «Comercio → categoría» (SPEC CA4.3): propone la categoría recordada mientras no se elija a mano
  useEffect(() => {
    if (categoriaElegidaAMano || sentido !== 'salida' || texto.trim().length < 2) return;
    let vigente = true;
    const espera = window.setTimeout(() => {
      void categoriaRecordada(espacioId, texto).then((id) => {
        if (vigente && id && categorias.some((c) => c.id === id && c.sentido === 'salida')) setCategoriaId(id);
      });
    }, 250);
    return () => {
      vigente = false;
      window.clearTimeout(espera);
    };
  }, [texto, sentido, espacioId, categoriaElegidaAMano, categorias]);

  async function enviar(e: Event) {
    e.preventDefault();
    const problemas: string[] = [];
    const importe = parsearImporte(importeTexto);
    if (!importe.ok) {
      problemas.push(
        importe.motivo === 'vacio'
          ? 'Escribe el importe.'
          : importe.motivo === 'ambiguo'
            ? 'El importe es ambiguo: escribe 1.234 para mil doscientos o 1,23 para uno con veintitrés.'
            : 'El importe no es válido. Ejemplos: 12,50 o 1.234,56.',
      );
    } else if (importe.importe <= 0) {
      problemas.push('El importe debe ser mayor que cero.');
    }
    if (!categoriaId) problemas.push('Elige una categoría.');
    if (!esFechaISO(fecha)) problemas.push('La fecha no es válida.');
    setErrores(problemas);
    if (problemas.length > 0 || !importe.ok || !esFechaISO(fecha)) return;

    const limpio = texto.trim();
    setGuardando(true);
    try {
      await onGuardar({
        espacio_id: espacioId,
        fecha,
        importe: importe.importe,
        sentido,
        categoria_id: categoriaId,
        naturaleza: fijo ? 'fijo' : 'variable',
        comercio: sentido === 'salida' && limpio ? limpio : null,
        concepto: sentido === 'entrada' && limpio ? limpio : null,
      });
    } catch (error) {
      setErrores([error instanceof Error ? error.message : 'No se ha podido guardar.']);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form class="formulario" onSubmit={(e) => void enviar(e)} noValidate>
      <fieldset class="segmentado">
        <legend class="solo-lectores">Tipo de movimiento</legend>
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
        <input
          type="text"
          maxLength={sentido === 'salida' ? 80 : 120}
          autoComplete="off"
          placeholder={sentido === 'salida' ? 'Ej.: Mercadona' : 'Ej.: Nómina de septiembre'}
          value={texto}
          onInput={(e) => setTexto(e.currentTarget.value)}
        />
      </label>

      <label class="campo">
        <span>Categoría</span>
        <select
          value={categoriaId}
          onChange={(e) => {
            setCategoriaId(e.currentTarget.value);
            setCategoriaElegidaAMano(true);
          }}
        >
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
          <span>Fecha</span>
          <input type="date" value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} />
        </label>
        <label class="casilla">
          <input type="checkbox" checked={fijo} onChange={(e) => setFijo(e.currentTarget.checked)} />
          <span>{sentido === 'salida' ? 'Gasto fijo' : 'Ingreso fijo'}</span>
        </label>
      </div>

      {errores.length > 0 && (
        <ul class="error" role="alert">
          {errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <button class="boton boton--principal" type="submit" disabled={guardando}>
        {guardando ? 'Guardando…' : textoBoton}
      </button>
    </form>
  );
}
