import { diasEntre, type FechaISO } from '../nucleo/fechas';

// Recordatorios del Resumen (SPEC CA8.3, CA8.5): valores de fondos y liquidez con más de N días.
export const DIAS_RECORDATORIO_DEFECTO = 30;

export interface Recordatorio {
  tipo: 'fondo' | 'liquidez';
  /** Texto para mostrar */
  texto: string;
  enlace: string;
  /** Días desde el último apunte (null si nunca se ha apuntado) */
  dias: number | null;
}

export function recordatorios(
  hoy: FechaISO,
  fondos: readonly { id: string; nombre: string; ultimaValoracion: FechaISO | null }[],
  ultimaLiquidez: FechaISO | null | undefined,
  dias = DIAS_RECORDATORIO_DEFECTO,
): Recordatorio[] {
  const resultado: Recordatorio[] = [];
  for (const f of fondos) {
    const transcurridos = f.ultimaValoracion ? diasEntre(f.ultimaValoracion, hoy) : null;
    if (transcurridos === null || transcurridos > dias) {
      resultado.push({
        tipo: 'fondo',
        texto:
          transcurridos === null
            ? `Apunta el valor de ${f.nombre} (aún no tiene ninguno)`
            : `Actualiza el valor de ${f.nombre} (hace ${transcurridos} días)`,
        enlace: `#/fondos/${f.id}/valorar`,
        dias: transcurridos,
      });
    }
  }
  // undefined = la liquidez no se usa todavía (no se recuerda); null = nunca apuntada
  if (ultimaLiquidez !== undefined) {
    const transcurridos = ultimaLiquidez ? diasEntre(ultimaLiquidez, hoy) : null;
    if (transcurridos === null || transcurridos > dias) {
      resultado.push({
        tipo: 'liquidez',
        texto: transcurridos === null ? 'Apunta tu liquidez (saldo de tus cuentas)' : `Actualiza tu liquidez (hace ${transcurridos} días)`,
        enlace: '#/ajustes/liquidez',
        dias: transcurridos,
      });
    }
  }
  return resultado;
}
