// Fechas de calendario como cadenas ISO «AAAA-MM-DD» (sin horas ni zonas horarias)
// y meses como «AAAA-MM». Así un gasto del día 31 nunca cambia de mes por la zona horaria.
export type FechaISO = string & { readonly __marca: 'FechaISO' };
export type ClaveMes = string & { readonly __marca: 'ClaveMes' };

export function fechaISO(anio: number, mes: number, dia: number): FechaISO {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    throw new RangeError(`Fecha imposible: ${anio}-${mes}-${dia}`);
  }
  return `${String(anio).padStart(4, '0')}-${dos(mes)}-${dos(dia)}` as FechaISO;
}

export function esFechaISO(texto: string): texto is FechaISO {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  try {
    fechaISO(Number(m[1]), Number(m[2]), Number(m[3]));
    return true;
  } catch {
    return false;
  }
}

/** Fecha de hoy en la zona horaria del dispositivo. */
export function hoy(ahora: Date = new Date()): FechaISO {
  return fechaISO(ahora.getFullYear(), ahora.getMonth() + 1, ahora.getDate());
}

export function claveMes(fecha: FechaISO): ClaveMes {
  return fecha.slice(0, 7) as ClaveMes;
}

export function sumarMeses(mes: ClaveMes, n: number): ClaveMes {
  const [anio = 0, m = 1] = mes.split('-').map(Number);
  const total = anio * 12 + (m - 1) + n;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${dos((total % 12) + 1)}` as ClaveMes;
}

/** Los n meses completos anteriores al mes de `referencia`, del más antiguo al más reciente. */
export function mesesCompletosAnteriores(referencia: FechaISO, n: number): ClaveMes[] {
  const actual = claveMes(referencia);
  return Array.from({ length: n }, (_, i) => sumarMeses(actual, i - n));
}

/** Meses de diferencia entre dos claves de mes: («2026-01», «2026-04») → 3. */
export function mesesEntre(desde: ClaveMes, hasta: ClaveMes): number {
  const [a1 = 0, m1 = 1] = desde.split('-').map(Number);
  const [a2 = 0, m2 = 1] = hasta.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

export function ultimoDiaDelMes(mes: ClaveMes): number {
  const [anio = 0, m = 1] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio, m, 0)).getUTCDate();
}

function dos(n: number): string {
  return String(n).padStart(2, '0');
}
