import { centimos, type Centimos } from '../nucleo/dinero';
import { diasEntre, type ClaveMes, type FechaISO } from '../nucleo/fechas';
import { formatearEUR, formatearPorcentaje } from '../nucleo/formato';
import { nombreMes } from '../nucleo/textos';

// Consejos por reglas (SPEC §7.6, F11). Funciones puras: cada consejo dice en qué datos se basa,
// el cálculo con los números sustituidos y el umbral. Orientativos: no son asesoramiento financiero.
export type Severidad = 'importante' | 'aviso' | 'info';

export interface Consejo {
  id: string;
  titulo: string;
  texto: string;
  datosUsados: string[];
  calculo: string;
  umbral: string;
  severidad: Severidad;
  enlace?: { texto: string; ruta: string };
}

export interface MesResumido {
  mes: ClaveMes;
  entradas: Centimos;
  salidas: Centimos;
  /** Salidas por nombre de categoría */
  porCategoria: Record<string, Centimos>;
}

export interface DatosConsejos {
  hoy: FechaISO;
  /** Meses completos, del más antiguo al más reciente (hasta 12) */
  meses: MesResumido[];
  liquidez: { fecha: FechaISO; importe: Centimos } | null;
  fondos: { nombre: string; ter: number; ultimaValoracion: FechaISO | null }[];
  /** Recurrentes de la categoría «Suscripciones», en coste anual */
  suscripciones: { nombre: string; anual: Centimos }[];
  saldos: { espacio: string; tipo: 'te-deben' | 'debes'; importe: Centimos; desde: FechaISO | null }[];
}

export interface Umbrales {
  /** Tasa de ahorro mínima (0,10 = 10 %) */
  tasaAhorro: number;
  /** Meses de gastos que debería cubrir el colchón */
  mesesColchon: number;
  /** Meses a partir de los cuales sobra liquidez */
  mesesExceso: number;
  /** TER máximo razonable para un indexado (%) */
  terMaximo: number;
  /** Subida de una categoría frente a su media (0,2 = 20 %) */
  subidaCategoria: number;
  /** Media mínima para avisar de una categoría (céntimos) */
  mediaMinimaCategoria: number;
  /** Días para recordar saldos, valores y liquidez */
  dias: number;
}

export const UMBRALES_DEFECTO: Umbrales = {
  tasaAhorro: 0.1,
  mesesColchon: 3,
  mesesExceso: 6,
  terMaximo: 0.5,
  subidaCategoria: 0.2,
  mediaMinimaCategoria: 3000,
  dias: 30,
};

const eur = (c: number) => formatearEUR(centimos(Math.round(c)));
const pct = (x: number) => formatearPorcentaje(x);
const coma = (x: number, decimales = 1) => x.toFixed(decimales).replace('.', ',');

function gastoMedio(meses: readonly MesResumido[]): number | null {
  return meses.length === 0 ? null : meses.reduce((t, m) => t + m.salidas, 0) / meses.length;
}

function tasaAhorro(d: DatosConsejos, u: Umbrales): Consejo | null {
  const ultimos = d.meses.slice(-3);
  const entradas = ultimos.reduce((t, m) => t + m.entradas, 0);
  const salidas = ultimos.reduce((t, m) => t + m.salidas, 0);
  if (ultimos.length === 0 || entradas <= 0) return null;
  const tasa = (entradas - salidas) / entradas;
  if (tasa >= u.tasaAhorro) return null;
  return {
    id: 'tasa-ahorro',
    titulo: 'Ahorras menos de lo recomendable',
    texto: `En los últimos ${ultimos.length} meses ahorraste el ${pct(tasa)} de tus ingresos (objetivo: ${pct(u.tasaAhorro)}).`,
    datosUsados: [`Entradas de ${ultimos.length} meses: ${eur(entradas)}`, `Salidas de ${ultimos.length} meses: ${eur(salidas)}`],
    calculo: `(${eur(entradas)} − ${eur(salidas)}) ÷ ${eur(entradas)} = ${pct(tasa)}`,
    umbral: `Menos del ${pct(u.tasaAhorro)}`,
    severidad: tasa < 0 ? 'importante' : 'aviso',
    enlace: { texto: 'Ver en qué gastas', ruta: '/resumen' },
  };
}

function colchon(d: DatosConsejos, u: Umbrales): Consejo | null {
  const medio = gastoMedio(d.meses);
  if (!d.liquidez || medio === null || medio <= 0) return null;
  const meses = d.liquidez.importe / medio;
  const datos = [`Liquidez: ${eur(d.liquidez.importe)}`, `Gasto medio de ${d.meses.length} meses: ${eur(medio)}`];
  if (meses < u.mesesColchon) {
    return {
      id: 'colchon',
      titulo: 'Tu colchón es corto',
      texto: `Tu liquidez cubre ${coma(meses)} meses de gastos. Lo habitual es tener al menos ${u.mesesColchon}.`,
      datosUsados: datos,
      calculo: `${eur(d.liquidez.importe)} ÷ ${eur(medio)} = ${coma(meses)} meses`,
      umbral: `Menos de ${u.mesesColchon} meses`,
      severidad: 'importante',
    };
  }
  if (meses > u.mesesExceso) {
    const excedente = d.liquidez.importe - u.mesesExceso * medio;
    return {
      id: 'exceso-liquidez',
      titulo: 'Tienes liquidez de sobra',
      texto: `Tienes ${eur(excedente)} por encima de ${u.mesesExceso} meses de gastos. Mira cuánto podría rendir invertido.`,
      datosUsados: datos,
      calculo: `${eur(d.liquidez.importe)} − ${u.mesesExceso} × ${eur(medio)} = ${eur(excedente)}`,
      umbral: `Más de ${u.mesesExceso} meses de gastos`,
      severidad: 'info',
      enlace: { texto: 'Abrir el simulador con esa cifra', ruta: `/simulador?inicial=${Math.floor(excedente / 100)}` },
    };
  }
  return null;
}

function terAlto(d: DatosConsejos, u: Umbrales): Consejo[] {
  return d.fondos
    .filter((f) => f.ter > u.terMaximo)
    .map((f) => ({
      id: `ter-alto:${f.nombre}`,
      titulo: `El TER de ${f.nombre} es alto para un indexado`,
      texto: `Su TER es del ${coma(f.ter, 2)} %: con 10.000 € invertidos son unos ${eur(f.ter * 10000)} al año.`,
      datosUsados: [`TER de ${f.nombre}: ${coma(f.ter, 2)} %`],
      calculo: `10.000 € × ${coma(f.ter, 2)} % = ${eur(f.ter * 10000)} al año`,
      umbral: `TER superior al ${coma(u.terMaximo, 2)} %`,
      severidad: 'aviso' as const,
    }));
}

function categoriaSube(d: DatosConsejos, u: Umbrales): Consejo[] {
  const ultimo = d.meses.at(-1);
  const previos = d.meses.slice(-4, -1);
  if (!ultimo || previos.length < 3) return [];
  return Object.entries(ultimo.porCategoria).flatMap(([nombre, gasto]) => {
    const media = previos.reduce((t, m) => t + (m.porCategoria[nombre] ?? 0), 0) / previos.length;
    if (media < u.mediaMinimaCategoria) return [];
    const subida = (gasto - media) / media;
    if (subida <= u.subidaCategoria) return [];
    return [
      {
        id: `categoria-sube:${nombre}`,
        titulo: `${nombre}: +${pct(subida)} frente a tu media`,
        texto: `En ${nombreMes(ultimo.mes).toLowerCase()} gastaste ${eur(gasto)} en ${nombre}; tu media de los 3 meses anteriores es ${eur(media)}.`,
        datosUsados: [`${nombre} en ${nombreMes(ultimo.mes)}: ${eur(gasto)}`, `Media de 3 meses: ${eur(media)}`],
        calculo: `(${eur(gasto)} − ${eur(media)}) ÷ ${eur(media)} = +${pct(subida)}`,
        umbral: `Más de un ${pct(u.subidaCategoria)} sobre una media de al menos ${eur(u.mediaMinimaCategoria)}`,
        severidad: 'aviso' as const,
      },
    ];
  });
}

function suscripciones(d: DatosConsejos): Consejo | null {
  if (d.suscripciones.length === 0) return null;
  const total = d.suscripciones.reduce((t, s) => t + s.anual, 0);
  return {
    id: 'suscripciones',
    titulo: `Tus suscripciones suman ${eur(total)} al año`,
    texto: '¿Las usas todas? Revisarlas de vez en cuando es un ahorro fácil.',
    datosUsados: d.suscripciones.map((s) => `${s.nombre}: ${eur(s.anual)}/año`),
    calculo: d.suscripciones.map((s) => eur(s.anual)).join(' + ') + ` = ${eur(total)}`,
    umbral: 'Informativo (recurrentes de la categoría «Suscripciones»)',
    severidad: 'info',
    enlace: { texto: 'Ver recurrentes', ruta: '/recurrentes' },
  };
}

function saldosPendientes(d: DatosConsejos, u: Umbrales): Consejo[] {
  return d.saldos.flatMap((s) => {
    const dias = s.desde ? diasEntre(s.desde, d.hoy) : null;
    if (dias === null || dias <= u.dias) return [];
    return [
      {
        id: `saldo-pendiente:${s.espacio}`,
        titulo: `${s.espacio}: saldo pendiente desde hace ${dias} días`,
        texto: s.tipo === 'debes' ? `Debes ${eur(s.importe)}. ¿Lo saldas?` : `Te deben ${eur(s.importe)}. ¿Lo saldáis?`,
        datosUsados: [`Saldo de ${s.espacio}: ${eur(s.importe)}`, `Desde: ${s.desde ?? ''}`],
        calculo: `${dias} días desde el último pago registrado (o el primer gasto)`,
        umbral: `Más de ${u.dias} días`,
        severidad: 'aviso' as const,
        enlace: { texto: 'Ir a Común', ruta: '/comun' },
      },
    ];
  });
}

function sinActualizar(d: DatosConsejos, u: Umbrales): Consejo[] {
  const consejos: Consejo[] = [];
  for (const f of d.fondos) {
    const dias = f.ultimaValoracion ? diasEntre(f.ultimaValoracion, d.hoy) : null;
    if (dias !== null && dias > u.dias) {
      consejos.push({
        id: `fondo-sin-valorar:${f.nombre}`,
        titulo: `Actualiza el valor de ${f.nombre}`,
        texto: `El último valor es de hace ${dias} días: los indicadores de tu cartera pueden estar desfasados.`,
        datosUsados: [`Último valor: ${f.ultimaValoracion ?? ''}`],
        calculo: `${d.hoy} − ${f.ultimaValoracion ?? ''} = ${dias} días`,
        umbral: `Más de ${u.dias} días`,
        severidad: 'info',
        enlace: { texto: 'Ir a Fondos', ruta: '/fondos' },
      });
    }
  }
  if (d.liquidez) {
    const dias = diasEntre(d.liquidez.fecha, d.hoy);
    if (dias > u.dias) {
      consejos.push({
        id: 'liquidez-sin-actualizar',
        titulo: 'Actualiza tu liquidez',
        texto: `El último apunte es de hace ${dias} días: los consejos de colchón usan ese dato.`,
        datosUsados: [`Último apunte: ${d.liquidez.fecha}`],
        calculo: `${d.hoy} − ${d.liquidez.fecha} = ${dias} días`,
        umbral: `Más de ${u.dias} días`,
        severidad: 'info',
        enlace: { texto: 'Apuntar liquidez', ruta: '/ajustes/liquidez' },
      });
    }
  }
  return consejos;
}

const ORDEN: Record<Severidad, number> = { importante: 0, aviso: 1, info: 2 };

export function consejos(d: DatosConsejos, u: Umbrales = UMBRALES_DEFECTO): Consejo[] {
  return [
    tasaAhorro(d, u),
    colchon(d, u),
    ...terAlto(d, u),
    ...categoriaSube(d, u),
    suscripciones(d),
    ...saldosPendientes(d, u),
    ...sinActualizar(d, u),
  ]
    .filter((c): c is Consejo => c !== null)
    .sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]);
}
