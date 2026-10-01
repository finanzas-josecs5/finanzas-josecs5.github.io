import { useEffect, useRef, useState } from 'preact/hooks';
import { escalaBonita } from '../../movimientos/historico';

export interface GrupoBarras {
  clave: string;
  etiqueta: string;
  /** Texto completo para lectores de pantalla y la línea de lectura */
  descripcion: string;
  valores: number[];
}

interface Props {
  idTitulo: string;
  grupos: GrupoBarras[];
  /** Clase CSS de cada serie (su color sale de los tokens --serie-*) */
  clases: string[];
  formatoEje: (valor: number) => string;
  seleccionado: string | null;
  onSeleccionar: (clave: string) => void;
}

const ALTO = 220;
const MARGEN = { izquierda: 64, derecha: 8, arriba: 8, abajo: 28 };

/** Barra con las esquinas superiores redondeadas (4 px) y anclada a la línea base. */
function rutaBarra(x: number, y: number, ancho: number, alto: number): string {
  const r = Math.min(4, ancho / 2, alto);
  return `M${x},${y + alto}V${y + r}Q${x},${y} ${x + r},${y}H${x + ancho - r}Q${x + ancho},${y} ${x + ancho},${y + r}V${y + alto}Z`;
}

/**
 * Barras agrupadas en SVG propio (SPEC §9: sin librerías). Un solo eje; marcas finas;
 * 2 px de separación entre barras; rejilla discreta. Se dibuja al ancho real del
 * contenedor para que el texto no se deforme.
 */
export function Barras({ idTitulo, grupos, clases, formatoEje, seleccionado, onSeleccionar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(360);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setAncho(Math.max(280, Math.round(entrada.contentRect.width)));
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const maximoDatos = Math.max(0, ...grupos.flatMap((g) => g.valores));
  const { maximo, paso } = escalaBonita(maximoDatos);
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const anchoUtil = ancho - MARGEN.izquierda - MARGEN.derecha;
  const anchoGrupo = anchoUtil / Math.max(1, grupos.length);
  const series = clases.length;
  const anchoBarra = Math.max(2, Math.min(18, (anchoGrupo - 8 - 2 * (series - 1)) / series));
  const y = (v: number) => MARGEN.arriba + altoUtil - (v / maximo) * altoUtil;
  const marcas = Array.from({ length: Math.round(maximo / paso) + 1 }, (_, i) => i * paso);
  const cadaEtiqueta = anchoGrupo < 30 ? 2 : 1; // en móvil, una etiqueta de mes sí y otra no

  return (
    <div class="grafico" ref={contenedor}>
      <svg
        width={ancho}
        height={ALTO}
        viewBox={`0 0 ${ancho} ${ALTO}`}
        role="group"
        aria-labelledby={idTitulo}
        class="grafico__svg"
      >
        {marcas.map((m) => (
          <g key={m} class="grafico__rejilla">
            <line x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(m)} y2={y(m)} />
            <text x={MARGEN.izquierda - 8} y={y(m)} dy="0.32em" text-anchor="end">
              {formatoEje(m)}
            </text>
          </g>
        ))}
        {grupos.map((g, i) => {
          const x0 = MARGEN.izquierda + i * anchoGrupo;
          const anchoBarras = series * anchoBarra + 2 * (series - 1);
          const inicio = x0 + (anchoGrupo - anchoBarras) / 2;
          const activo = g.clave === seleccionado;
          return (
            <g
              key={g.clave}
              class={`grafico__grupo${activo ? ' grafico__grupo--activo' : ''}`}
              tabIndex={0}
              role="button"
              aria-label={g.descripcion}
              aria-pressed={activo}
              onMouseEnter={() => onSeleccionar(g.clave)}
              onFocus={() => onSeleccionar(g.clave)}
              onClick={() => onSeleccionar(g.clave)}
            >
              <rect class="grafico__foco" x={x0} y={MARGEN.arriba} width={anchoGrupo} height={altoUtil} />
              {g.valores.map((v, s) => {
                const alto = (v / maximo) * altoUtil;
                if (alto <= 0) return null;
                return (
                  <path
                    key={s}
                    class={`grafico__barra ${clases[s] ?? ''}`}
                    d={rutaBarra(inicio + s * (anchoBarra + 2), y(v), anchoBarra, alto)}
                  />
                );
              })}
              {i % cadaEtiqueta === (grupos.length - 1) % cadaEtiqueta && (
                <text class="grafico__etiqueta" x={x0 + anchoGrupo / 2} y={ALTO - 8} text-anchor="middle">
                  {g.etiqueta}
                </text>
              )}
            </g>
          );
        })}
        <line class="grafico__base" x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(0)} y2={y(0)} />
      </svg>
    </div>
  );
}
