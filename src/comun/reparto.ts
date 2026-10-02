import { centimos, type Centimos } from '../nucleo/dinero';

// Reparto de un gasto compartido (SPEC §4.6, CA6.1, CA6.7). Funciones puras.
/** Porcentaje de cada miembro: { "<user_id>": 50, … }. Suma 100 (lo valida la base de datos). */
export type Reparto = Record<string, number>;

/**
 * Partes en céntimos. Quien no pagó paga floor(importe × %); quien pagó asume el resto,
 * así los céntimos sueltos del redondeo nunca recaen en el otro (10,01 € al 50/50 → 5,00 y 5,01).
 */
export function repartir(importe: Centimos, pagador: string, reparto: Reparto): Map<string, Centimos> {
  const partes = new Map<string, Centimos>();
  let asignado = 0;
  for (const [usuario, porcentaje] of Object.entries(reparto)) {
    if (usuario === pagador) continue;
    const parte = Math.floor((importe * porcentaje) / 100);
    partes.set(usuario, centimos(parte));
    asignado += parte;
  }
  partes.set(pagador, centimos(importe - asignado));
  return partes;
}

/** Parte de un usuario en un gasto (0 si no participa). */
export function parteDe(usuario: string, importe: Centimos, pagador: string, reparto: Reparto): Centimos {
  return repartir(importe, pagador, reparto).get(usuario) ?? centimos(0);
}

/** Reparto con mi porcentaje y el resto para la otra persona (espacios de dos). */
export function repartoConMiParte(yo: string, otro: string, miPorcentaje: number): Reparto {
  const mio = Math.min(100, Math.max(0, Math.round(miPorcentaje * 100) / 100));
  return { [yo]: mio, [otro]: Math.round((100 - mio) * 100) / 100 };
}

/** Reparto por defecto del espacio a partir de sus miembros. */
export function repartoPorDefecto(miembros: readonly { user_id: string; porcentaje_defecto: number }[]): Reparto {
  return Object.fromEntries(miembros.map((m) => [m.user_id, Number(m.porcentaje_defecto)]));
}
