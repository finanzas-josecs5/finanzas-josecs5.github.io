import { useEffect, useRef, useState } from 'preact/hooks';
import { categoriaRecordada, crearMovimiento, recordarComercio, type Categoria } from '../datos/repos/movimientos';
import { useEspacios } from '../espacios/estado';
import { useCategorias } from '../movimientos/Nuevo';
import { parsearImporte, textoEditable } from '../nucleo/dinero';
import { esFechaISO, hoy } from '../nucleo/fechas';
import { ListaErrores } from '../ui/ListaErrores';
import { extraer, type Confianza } from './extraer';
import { reconocerTexto } from './motor';
import { prepararImagen } from './preprocesado';

type Estado = 'en-cola' | 'leyendo' | 'lista' | 'error' | 'guardando';

interface Tarjeta {
  id: string;
  nombre: string;
  url: string;
  estado: Estado;
  confianza: Confianza;
  importeTexto: string;
  fecha: string;
  comercio: string;
  categoriaId: string;
  errores: string[];
}

let contador = 0;

/**
 * Gastos desde fotos de tickets (SPEC §4.5, CA5.5, CA5.6). El texto se lee en el navegador
 * con el motor alojado en /ocr/; la imagen solo existe en memoria (blob:) y nunca se sube.
 * Cada imagen da una tarjeta editable; nada se guarda sin confirmarlo.
 */
export function DesdeFoto() {
  const { actual } = useEspacios();
  const { categorias } = useCategorias(actual?.id);
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [guardadas, setGuardadas] = useState(0);
  const vivas = useRef<Tarjeta[]>([]);
  vivas.current = tarjetas;

  // Al salir de la página se liberan las imágenes que queden en memoria
  useEffect(() => () => vivas.current.forEach((t) => URL.revokeObjectURL(t.url)), []);

  const actualizar = (id: string, cambios: Partial<Tarjeta>) =>
    setTarjetas((previas) => previas.map((t) => (t.id === id ? { ...t, ...cambios } : t)));

  const quitar = (t: Tarjeta) => {
    URL.revokeObjectURL(t.url);
    setTarjetas((previas) => previas.filter((x) => x.id !== t.id));
  };

  async function alElegir(e: Event) {
    const entrada = e.currentTarget as HTMLInputElement;
    const archivos = [...(entrada.files ?? [])];
    entrada.value = '';
    if (!actual || archivos.length === 0) return;
    const nuevas: [Tarjeta, File][] = archivos.map((archivo) => [
      {
        id: `foto-${(contador += 1)}`,
        nombre: archivo.name,
        url: URL.createObjectURL(archivo),
        estado: 'en-cola',
        confianza: 'baja',
        importeTexto: '',
        fecha: hoy(),
        comercio: '',
        categoriaId: '',
        errores: [],
      },
      archivo,
    ]);
    setTarjetas((previas) => [...previas, ...nuevas.map(([t]) => t)]);

    // Una a una: el motor usa un único worker y así el móvil no se queda sin memoria
    for (const [tarjeta, archivo] of nuevas) {
      actualizar(tarjeta.id, { estado: 'leyendo' });
      try {
        const datos = extraer(await reconocerTexto(await prepararImagen(archivo)));
        const categoriaId = datos.comercio ? ((await categoriaRecordada(actual.id, datos.comercio)) ?? '') : '';
        actualizar(tarjeta.id, {
          estado: 'lista',
          confianza: datos.confianza,
          importeTexto: datos.importe === null ? '' : textoEditable(datos.importe),
          fecha: datos.fecha ?? hoy(),
          comercio: datos.comercio ?? '',
          categoriaId,
        });
      } catch (error) {
        actualizar(tarjeta.id, {
          estado: 'error',
          errores: [error instanceof Error ? error.message : 'No se ha podido leer la imagen. Puedes escribir los datos a mano.'],
        });
      }
    }
  }

  async function guardar(t: Tarjeta): Promise<boolean> {
    if (!actual) return false;
    const importe = parsearImporte(t.importeTexto);
    const problemas: string[] = [];
    if (!importe.ok || importe.importe <= 0) problemas.push('Revisa el importe (por ejemplo 12,10).');
    if (!t.categoriaId) problemas.push('Elige una categoría.');
    if (!esFechaISO(t.fecha)) problemas.push('La fecha no es válida.');
    if (problemas.length > 0 || !importe.ok || !esFechaISO(t.fecha)) {
      actualizar(t.id, { errores: problemas });
      return false;
    }
    actualizar(t.id, { estado: 'guardando', errores: [] });
    try {
      const comercio = t.comercio.trim() || null;
      await crearMovimiento({
        espacio_id: actual.id,
        fecha: t.fecha,
        importe: importe.importe,
        sentido: 'salida',
        categoria_id: t.categoriaId,
        naturaleza: 'variable',
        comercio,
        concepto: null,
        origen: 'ocr',
      });
      if (comercio) await recordarComercio(actual.id, comercio, t.categoriaId);
      quitar(t);
      setGuardadas((n) => n + 1);
      return true;
    } catch (error) {
      actualizar(t.id, { estado: 'lista', errores: [error instanceof Error ? error.message : 'No se ha podido guardar.'] });
      return false;
    }
  }

  async function guardarTodas() {
    for (const t of vivas.current.filter((x) => x.estado === 'lista' || x.estado === 'error')) await guardar(t);
  }

  if (!actual || !categorias) return <p class="cargando">Cargando…</p>;
  const pendientes = tarjetas.filter((t) => t.estado === 'lista' || t.estado === 'error').length;

  return (
    <section>
      <p>
        <a href="#/movimientos">‹ Movimientos</a>
      </p>
      <h1>Gastos desde foto</h1>
      <p class="nota">
        Espacio: {actual.nombre}. La imagen se lee en tu móvil y no se sube a ningún sitio. La primera vez se descarga el lector (unos
        4 MB).
      </p>

      <label class="boton boton--principal boton-archivo">
        Elegir fotos de tickets
        <input type="file" accept="image/*" multiple onChange={(e) => void alElegir(e)} />
      </label>

      {guardadas > 0 && (
        <p class="aviso" role="status">
          {guardadas === 1 ? '1 gasto guardado.' : `${guardadas} gastos guardados.`} <a href="#/movimientos">Ver movimientos</a>
        </p>
      )}

      {pendientes > 1 && (
        <p>
          <button class="boton" type="button" onClick={() => void guardarTodas()}>
            Guardar todos ({pendientes})
          </button>
        </p>
      )}

      <div class="tarjetas-ocr">
        {tarjetas.map((t) => (
          <TarjetaTicket
            key={t.id}
            tarjeta={t}
            categorias={categorias}
            onCambiar={(cambios) => actualizar(t.id, cambios)}
            onGuardar={() => void guardar(t)}
            onDescartar={() => quitar(t)}
          />
        ))}
      </div>
    </section>
  );
}

function TarjetaTicket(p: {
  tarjeta: Tarjeta;
  categorias: Categoria[];
  onCambiar: (cambios: Partial<Tarjeta>) => void;
  onGuardar: () => void;
  onDescartar: () => void;
}) {
  const t = p.tarjeta;
  const editable = t.estado === 'lista' || t.estado === 'error';
  const dudosa = t.estado === 'lista' && t.confianza !== 'alta';
  return (
    <article class={`tarjeta tarjeta-ocr${dudosa ? ' tarjeta-ocr--revisar' : ''}`} aria-label={`Ticket ${t.nombre}`}>
      <img class="tarjeta-ocr__miniatura" src={t.url} alt={`Foto del ticket ${t.nombre}`} />
      <div class="tarjeta-ocr__datos">
        <p class="nota" role="status">
          {t.estado === 'en-cola' && 'En espera…'}
          {t.estado === 'leyendo' && 'Leyendo el ticket…'}
          {t.estado === 'guardando' && 'Guardando…'}
          {t.estado === 'lista' && (dudosa ? '⚠ Revisa el importe: no se ha encontrado un TOTAL claro.' : 'Listo para revisar.')}
          {t.estado === 'error' && 'No se ha podido leer: escribe los datos a mano.'}
        </p>
        {editable && (
          <>
            <div class="fila-campos fila-campos--iguales">
              <label class="campo">
                <span>Importe (€)</span>
                <input type="text" inputMode="decimal" value={t.importeTexto} onInput={(e) => p.onCambiar({ importeTexto: e.currentTarget.value })} />
              </label>
              <label class="campo">
                <span>Fecha</span>
                <input type="date" value={t.fecha} onInput={(e) => p.onCambiar({ fecha: e.currentTarget.value })} />
              </label>
            </div>
            <label class="campo">
              <span>Comercio</span>
              <input type="text" maxLength={80} value={t.comercio} onInput={(e) => p.onCambiar({ comercio: e.currentTarget.value })} />
            </label>
            <label class="campo">
              <span>Categoría</span>
              <select value={t.categoriaId} onChange={(e) => p.onCambiar({ categoriaId: e.currentTarget.value })}>
                <option value="">Elige una categoría</option>
                {p.categorias
                  .filter((c) => c.sentido === 'salida')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <ListaErrores errores={t.errores} />
            <div class="acciones">
              <button class="boton boton--principal" type="button" onClick={p.onGuardar}>
                Guardar
              </button>
              <button class="boton" type="button" onClick={p.onDescartar}>
                Descartar
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
