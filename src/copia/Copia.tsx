import { useState } from 'preact/hooks';
import { recargarEspacios, useEspacios } from '../espacios/estado';
import { ListaErrores } from '../ui/ListaErrores';
import { cifrar, descifrar, estaCifrado } from './cifrado';
import { exportarDatos, importarDatos } from './datos';
import { nombreArchivo, validarCopia, type Copia } from './formato';

function descargar(contenido: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Ajustes → Copia de seguridad: exportar (cifrado por defecto) e importar (SPEC §4.11, F12). */
export function CopiaSeguridad() {
  const { espacios } = useEspacios();
  const [proteger, setProteger] = useState(true);
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erroresExportar, setErroresExportar] = useState<string[]>([]);
  const [exportando, setExportando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const [archivo, setArchivo] = useState<unknown>(null);
  const [claveImportar, setClaveImportar] = useState('');
  const [confirmando, setConfirmando] = useState<Copia | null>(null);
  const [erroresImportar, setErroresImportar] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);

  async function exportar(e: Event) {
    e.preventDefault();
    setMensaje('');
    const problemas: string[] = [];
    if (proteger && clave.length < 10) problemas.push('La contraseña de la copia debe tener al menos 10 caracteres.');
    if (proteger && clave !== repetida) problemas.push('Las dos contraseñas no coinciden.');
    setErroresExportar(problemas);
    if (problemas.length > 0) return;
    setExportando(true);
    try {
      const texto = JSON.stringify(await exportarDatos(espacios), null, 2);
      const contenido = proteger ? JSON.stringify(await cifrar(texto, clave), null, 2) : texto;
      descargar(contenido, nombreArchivo(new Date(), proteger));
      setMensaje(proteger ? 'Copia cifrada descargada. Guarda la contraseña: sin ella no se puede abrir.' : 'Copia descargada (sin cifrar).');
      setClave('');
      setRepetida('');
    } catch (error) {
      setErroresExportar([error instanceof Error ? error.message : 'No se ha podido exportar.']);
    } finally {
      setExportando(false);
    }
  }

  async function elegirArchivo(e: Event) {
    setErroresImportar([]);
    setConfirmando(null);
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      setArchivo(JSON.parse(await f.text()));
    } catch {
      setArchivo(null);
      setErroresImportar(['El archivo no es un JSON válido.']);
    }
  }

  async function preparar(e: Event) {
    e.preventDefault();
    setErroresImportar([]);
    try {
      const contenido: unknown = estaCifrado(archivo) ? JSON.parse(await descifrar(archivo, claveImportar)) : archivo;
      setConfirmando(validarCopia(contenido));
    } catch (error) {
      setErroresImportar([error instanceof Error ? error.message : 'No se ha podido leer la copia.']);
    }
  }

  async function importar() {
    const yo = espacios.find((x) => x.tipo === 'individual');
    if (!confirmando || !yo) return;
    setImportando(true);
    try {
      await importarDatos(confirmando, yo.id);
      await recargarEspacios();
      setConfirmando(null);
      setArchivo(null);
      setClaveImportar('');
      setMensaje('Copia importada: tus datos de «Yo» se han restaurado.');
    } catch (error) {
      setErroresImportar([error instanceof Error ? error.message : 'No se ha podido importar.']);
    } finally {
      setImportando(false);
    }
  }

  return (
    <section>
      <p>
        <a href="#/ajustes">‹ Ajustes</a>
      </p>
      <h1>Copia de seguridad</h1>
      {mensaje && (
        <p class="aviso" role="status">
          {mensaje}
        </p>
      )}

      <form class="formulario tarjeta bloque" onSubmit={(e) => void exportar(e)} noValidate aria-labelledby="titulo-exportar">
        <h2 id="titulo-exportar">Exportar</h2>
        <p class="nota">Todos tus datos y una copia de los espacios compartidos, en un archivo que se descarga en este dispositivo.</p>
        <label class="casilla">
          <input type="checkbox" checked={proteger} onChange={(e) => setProteger(e.currentTarget.checked)} />
          <span>Proteger con contraseña (recomendado)</span>
        </label>
        {proteger && (
          <div class="fila-campos fila-campos--iguales">
            <label class="campo">
              <span>Contraseña de la copia</span>
              <input type="password" autoComplete="new-password" value={clave} onInput={(e) => setClave(e.currentTarget.value)} />
            </label>
            <label class="campo">
              <span>Repite la contraseña</span>
              <input type="password" autoComplete="new-password" value={repetida} onInput={(e) => setRepetida(e.currentTarget.value)} />
            </label>
          </div>
        )}
        <ListaErrores errores={erroresExportar} />
        <button class="boton boton--principal" type="submit" disabled={exportando}>
          {exportando ? 'Preparando…' : 'Exportar'}
        </button>
      </form>

      <form class="formulario tarjeta bloque" onSubmit={(e) => void preparar(e)} noValidate aria-labelledby="titulo-importar">
        <h2 id="titulo-importar">Importar</h2>
        <p class="nota">
          Sustituye tus datos de «Yo» (movimientos, recurrentes, categorías, nómina, fondos, liquidez y ajustes) por los de la copia. Los
          espacios compartidos no se tocan.
        </p>
        <label class="campo">
          <span>Archivo de copia</span>
          <input type="file" accept="application/json,.json" onChange={(e) => void elegirArchivo(e)} />
        </label>
        {estaCifrado(archivo) && (
          <label class="campo">
            <span>Contraseña de la copia</span>
            <input type="password" autoComplete="off" value={claveImportar} onInput={(e) => setClaveImportar(e.currentTarget.value)} />
          </label>
        )}
        <ListaErrores errores={erroresImportar} />
        {!confirmando && (
          <button class="boton" type="submit" disabled={archivo === null}>
            Revisar copia
          </button>
        )}
        {confirmando && (
          <div role="group" aria-label="Confirmar importación" class="zona-peligro">
            <p>
              Copia del {new Date(confirmando.exportado).toLocaleString('es-ES')}: {confirmando.individual.movimientos.length} movimientos,{' '}
              {confirmando.individual.fondos.length} fondos. <strong>Se sustituirán tus datos actuales de «Yo». No se puede deshacer.</strong>
            </p>
            <div class="acciones">
              <button class="boton boton--peligro" type="button" disabled={importando} onClick={() => void importar()}>
                {importando ? 'Importando…' : 'Sí, importar'}
              </button>
              <button class="boton" type="button" onClick={() => setConfirmando(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
