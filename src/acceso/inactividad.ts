// Cierre de sesión por inactividad en el cliente (SPEC F1, CA1.5): 30 min por defecto.
// Se comprueba con la hora real (no con un único setTimeout) para que también funcione
// cuando el móvil suspende la pestaña y vuelve horas después.
export const MINUTOS_INACTIVIDAD_DEFECTO = 30;

export class RelojInactividad {
  private ultimaActividad: number;

  constructor(
    private readonly limiteMs: number,
    ahora: number,
  ) {
    this.ultimaActividad = ahora;
  }

  registrarActividad(ahora: number): void {
    this.ultimaActividad = Math.max(this.ultimaActividad, ahora);
  }

  haExpirado(ahora: number): boolean {
    return ahora - this.ultimaActividad >= this.limiteMs;
  }
}

const EVENTOS_DE_ACTIVIDAD = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/** Vigila la actividad del usuario y llama a `alExpirar` una sola vez. Devuelve la función de limpieza. */
export function vigilarInactividad(minutos: number, alExpirar: () => void): () => void {
  const reloj = new RelojInactividad(minutos * 60_000, Date.now());
  let expirado = false;

  const comprobar = () => {
    if (!expirado && reloj.haExpirado(Date.now())) {
      expirado = true;
      limpiar();
      alExpirar();
    }
  };
  const actividad = () => {
    comprobar();
    if (!expirado) reloj.registrarActividad(Date.now());
  };
  const alCambiarVisibilidad = () => {
    if (document.visibilityState === 'visible') comprobar();
  };

  for (const evento of EVENTOS_DE_ACTIVIDAD) window.addEventListener(evento, actividad, { passive: true });
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  const intervalo = window.setInterval(comprobar, 15_000);

  function limpiar() {
    for (const evento of EVENTOS_DE_ACTIVIDAD) window.removeEventListener(evento, actividad);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    window.clearInterval(intervalo);
  }
  return limpiar;
}
