import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../datos/cliente';
import { navegar } from '../ui/router';

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

export async function cerrarSesion(motivo?: 'inactividad'): Promise<void> {
  // scope local: cierra esta sesión sin afectar a la del otro dispositivo
  await supabase().auth.signOut({ scope: 'local' });
  navegar(motivo ? `/entrar?motivo=${motivo}` : '/entrar', true);
}
