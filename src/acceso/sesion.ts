import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'preact/hooks';
import { CLAVE_SESION, supabase } from '../datos/cliente';

export type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'con-sesion'; sesion: Session };

export function useSesion(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>({ tipo: 'cargando' });
  useEffect(() => {
    const auth = supabase().auth;
    const aplicar = (sesion: Session | null) =>
      setEstado(sesion ? { tipo: 'con-sesion', sesion } : { tipo: 'sin-sesion' });
    void auth.getSession().then(({ data }) => aplicar(data.session));
    const { data } = auth.onAuthStateChange((_evento, sesion) => aplicar(sesion));
    return () => data.subscription.unsubscribe();
  }, []);
  return estado;
}

/** La marca la pone la base de datos al crear la cuenta (migración 002, SPEC CA1.3). */
export function debeCambiarContrasena(sesion: Session): boolean {
  const metadatos = sesion.user.user_metadata as Record<string, unknown>;
  return metadatos.debe_cambiar_contrasena === true;
}

export type MotivoCierre = 'inactividad';

// El motivo se pasa en memoria: la pantalla de Entrar lo lee una vez al aparecer.
let motivoUltimoCierre: MotivoCierre | null = null;

export function tomarMotivoCierre(): MotivoCierre | null {
  const motivo = motivoUltimoCierre;
  motivoUltimoCierre = null;
  return motivo;
}

/**
 * Cierra la sesión de este dispositivo (scope local: no afecta a la del otro).
 * La app redirige sola a Entrar al recibir el evento de cierre.
 */
export async function cerrarSesion(motivo?: MotivoCierre): Promise<void> {
  motivoUltimoCierre = motivo ?? null;
  const { error } = await supabase().auth.signOut({ scope: 'local' });
  if (error) {
    // Sin conexión, supabase-js conserva la sesión: se borra igualmente en este
    // navegador para que el cierre por inactividad (CA1.5) nunca se quede a medias.
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch {
      /* sin almacenamiento */
    }
    window.location.reload();
  }
}
