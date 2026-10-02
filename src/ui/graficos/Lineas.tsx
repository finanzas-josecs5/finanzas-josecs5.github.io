import { useEffect, useRef, useState } from 'preact/hooks';
import { escalaBonita } from '../../movimientos/historico';

export interface SerieLinea {
  clase: string;
  valores: number[];
}

interface Props {
  idTitulo: string;
  etiquetas: string[];
  /** Descripción completa de cada punto (lectores de pantalla y línea de lectura) */
  descripciones: string[];
  series: SerieLinea[];
  /** Zona sombreada (p. ej. entre el escenario pesimista y el optimista) */
  banda?: { clase: string; inferior: number[]; superior: number[] } | undefined;
  formatoEje: (valor: number) => string;
  seleccionado: number;
  onSeleccionar: (indice: number) => void;
}

const ALTO = 240;
const MARGEN = { izquierda: 64, derecha: 12, arriba: 10, abajo: 28 };

/**
 * Líneas en SVG propio (SPEC §9; método dataviz: un solo eje, líneas de 2 px, rejilla discreta).
 * Cada punto del eje X es un botón invisible, así se puede recorrer con teclado o tocando.
 */
export function Lineas({ idTitulo, etiquetas, descripciones, series, banda, formatoEje, seleccionado, onSeleccionar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(360);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const observador = new ResizeObserver(([e]) => e && setAncho(Math.max(280, Math.round(e.contentRect.width))));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const n = etiquetas.length;
  const todos = [...series.flatMap((s) => s.valores), ...(banda?.superior ?? [])];
  const { maximo, paso } = escalaBonita(Math.max(0, ...todos));
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const anchoUtil = ancho - MARGEN.izquierda - MARGEN.derecha;
  const x = (i: number) => MARGEN.izquierda + (n <= 1 ? anchoUtil / 2 : (i * anchoUtil) / (n - 1));
  const y = (v: number) => MARGEN.arriba + altoUtil - (Math.max(0, v) / maximo) * altoUtil;
  const ruta = (valores: number[]) => valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const marcas = Array.from({ length: Math.round(maximo / paso) + 1 }, (_, i) => i * paso);
  const cadaEtiqueta = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(anchoUtil / 44))));
  const anchoPunto = n <= 1 ? anchoUtil : anchoUtil / (n - 1);

  return (
    <div class="grafico" ref={contenedor}>
      <svg width={ancho} height={ALTO} viewBox={`0 0 ${ancho} ${ALTO}`} role="group" aria-labelledby={idTitulo} class="grafico__svg">
        {marcas.map((m) => (
          <g key={m} class="grafico__rejilla">
            <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(m)} y2={y(m)} />
            <text x={MARGEN.izquierda - 8} y={y(m)} dy="0.32em" text-anchor="end">
              {formatoEje(m)}
            </text>
          </g>
        ))}
        {banda && (
          <path
            class={`grafico__banda ${banda.clase}`}
            d={`${ruta(banda.superior)}${[...banda.inferior]
              .map((v, i) => [v, i] as const)
              .reverse()
              .map(([v, i]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`)
              .join('')}Z`}
          />
        )}
        {seleccionado >= 0 && seleccionado < n && <line class="grafico__guia" x1={x(seleccionado)} x2={x(seleccionado)} y1={MARGEN.arriba} y2={MARGEN.arriba + altoUtil} />}
        {series.map((s) => (
          <path key={s.clase} class={`grafico__linea ${s.clase}`} d={ruta(s.valores)} />
        ))}
        {series.map((s) =>
          seleccionado >= 0 && seleccionado < n ? (
            <circle key={`p-${s.clase}`} class={`grafico__punto ${s.clase}`} cx={x(seleccionado)} cy={y(s.valores[seleccionado] ?? 0)} r={5} />
          ) : null,
        )}
        {etiquetas.map((e, i) => (
          <g
            key={e}
            class="grafico__grupo"
            tabIndex={0}
            role="button"
            aria-label={descripciones[i]}
            aria-pressed={i === seleccionado}
            onMouseEnter={() => onSeleccionar(i)}
            onFocus={() => onSeleccionar(i)}
            onClick={() => onSeleccionar(i)}
          >
            <rect class="grafico__foco" x={x(i) - anchoPunto / 2} y={MARGEN.arriba} width={anchoPunto} height={altoUtil} />
            {(i % cadaEtiqueta === 0 || i === n - 1) && (
              <text class="grafico__etiqueta" x={x(i)} y={ALTO - 8} text-anchor="middle">
                {e}
              </text>
            )}
          </g>
        ))}
        <line class="grafico__base" x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(0)} y2={y(0)} />
      </svg>
    </div>
  );
}
