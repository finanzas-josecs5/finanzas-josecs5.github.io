import { useEffect, useState } from 'preact/hooks';
import { useEspacios } from '../espacios/estado';
import { cargarDatosConsejos } from './datos';
import { consejos, type Consejo } from './reglas';

const ETIQUETA = { importante: 'Importante', aviso: 'Aviso', info: 'Info' } as const;

/**
 * Los ids de los consejos llevan nombres («ter-alto:Fondo caro»). En aria-labelledby los
 * espacios separan referencias, así que el id del título se limita a letras, números y guiones.
 */
export function idTitulo(idConsejo: string): string {
  return `consejo-${idConsejo
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase()}`;
}

export function useConsejos(): { lista: Consejo[] | null; error: string } {
  const { cargado, espacios } = useEspacios();
  const [lista, setLista] = useState<Consejo[] | null>(null);
  const [error, setError] = useState('');
  const clave = espacios.map((e) => e.id).join(',');
  useEffect(() => {
    if (!cargado) return;
    let vigente = true;
    cargarDatosConsejos(espacios).then(
      ({ datos, umbrales }) => vigente && setLista(consejos(datos, umbrales)),
      (e: Error) => vigente && setError(e.message),
    );
    return () => {
      vigente = false;
    };
  }, [cargado, clave]);
  return { lista, error };
}

/** Un consejo con su explicación desplegable (SPEC CA11.2: accesible con teclado). */
export function TarjetaConsejo({ consejo }: { consejo: Consejo }) {
  return (
    <article class={`tarjeta consejo consejo--${consejo.severidad}`} aria-labelledby={idTitulo(consejo.id)}>
      <p class="consejo__etiqueta">{ETIQUETA[consejo.severidad]}</p>
      <h3 id={idTitulo(consejo.id)}>{consejo.titulo}</h3>
      <p>{consejo.texto}</p>
      <details>
        <summary>¿En qué se basa?</summary>
        <dl class="consejo__detalle">
          <dt>Datos</dt>
          <dd>
            <ul>
              {consejo.datosUsados.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </dd>
          <dt>Cálculo</dt>
          <dd>{consejo.calculo}</dd>
          <dt>Umbral</dt>
          <dd>{consejo.umbral}</dd>
        </dl>
      </details>
      {consejo.enlace && (
        <p>
          <a href={`#${consejo.enlace.ruta}`}>{consejo.enlace.texto}</a>
        </p>
      )}
    </article>
  );
}

export const AVISO_ORIENTATIVO = 'Orientativo. No es asesoramiento financiero: la app nunca ejecuta operaciones.';

/** #/consejos: todos los consejos (SPEC F11). */
export function Consejos() {
  const { lista, error } = useConsejos();
  return (
    <section>
      <div class="titulo-con-accion">
        <h1>Consejos</h1>
        <a href="#/ajustes/preferencias">Umbrales</a>
      </div>
      <p class="nota">Calculados en tu navegador con tus datos. Cada uno explica en qué se basa.</p>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      {!error && lista === null && <p class="cargando">Cargando…</p>}
      {lista?.length === 0 && <p class="vacio">Nada que destacar ahora mismo. ¡Bien!</p>}
      <div class="consejos">
        {lista?.map((c) => (
          <TarjetaConsejo key={c.id} consejo={c} />
        ))}
      </div>
      <p class="nota">{AVISO_ORIENTATIVO}</p>
    </section>
  );
}

/** Los 3 primeros consejos en el Resumen de «Yo». */
export function ConsejosDestacados() {
  const { lista } = useConsejos();
  if (!lista || lista.length === 0) return null;
  return (
    <section class="bloque" aria-labelledby="titulo-consejos-destacados">
      <h2 id="titulo-consejos-destacados">Consejos</h2>
      <div class="consejos">
        {lista.slice(0, 3).map((c) => (
          <TarjetaConsejo key={c.id} consejo={c} />
        ))}
      </div>
      <p>
        <a href="#/consejos">Ver todos los consejos{lista.length > 3 ? ` (${lista.length})` : ''}</a>
      </p>
      <p class="nota">{AVISO_ORIENTATIVO}</p>
    </section>
  );
}
