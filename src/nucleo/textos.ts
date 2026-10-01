import type { ClaveMes, FechaISO } from './fechas';

const MES_ANIO = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DIA = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function mayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es-ES') + texto.slice(1);
}

/** «2026-09» → «Septiembre de 2026» */
export function nombreMes(mes: ClaveMes): string {
  return mayuscula(MES_ANIO.format(new Date(`${mes}-01T00:00:00Z`)));
}

/** «2026-09-05» → «Sábado, 5 de septiembre» */
export function nombreDia(fecha: FechaISO): string {
  return mayuscula(DIA.format(new Date(`${fecha}T00:00:00Z`)));
}
