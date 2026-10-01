import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { CambiarContrasena } from '../acceso/CambiarContrasena';
import { Entrar } from '../acceso/Entrar';
import { MINUTOS_INACTIVIDAD_DEFECTO, vigilarInactividad } from '../acceso/inactividad';
import { SegundoPaso } from '../acceso/SegundoPaso';
import { necesitaSegundoFactor } from '../acceso/mfa';
import { Seguridad } from '../acceso/Seguridad';
import { cerrarSesion, debeCambiarContrasena, useSesion } from '../acceso/sesion';
import { Ajustes } from '../ajustes/Ajustes';
import { backendConfigurado } from '../datos/cliente';
import { LabOcr } from './LabOcr';
import { Layout } from './Layout';
import { Pendiente } from './Pendiente';
import { navegar, RUTA_INICIO, useRuta } from './router';

/** Páginas dentro del marco de la app (con navegación). */
const PAGINAS: Record<string, () => ComponentChildren> = {
  '/resumen': () => <Pendiente titulo="Resumen" />,
  '/movimientos': () => <Pendiente titulo="Movimientos" />,
  '/movimientos/nuevo': () => <Pendiente titulo="Añadir gasto" />,
  '/comun': () => <Pendiente titulo="Común" />,
  '/fondos': () => <Pendiente titulo="Fondos" />,
  '/simulador': () => <Pendiente titulo="Simulador" />,
  '/ajustes': () => <Ajustes />,
  '/ajustes/seguridad': () => <Seguridad />,
};

export function App() {
  const { ruta } = useRuta();
  if (ruta === '/lab/ocr') return <LabOcr />;
  if (!backendConfigurado) {
    return (
      <main class="acceso">
        <div class="tarjeta acceso__formulario">
          <h1>Finanzas</h1>
          <p>La conexión con el servidor aún no está configurada.</p>
        </div>
      </main>
    );
  }
  return <ConSesion />;
}

/** Adónde debe ir el usuario según su sesión (SPEC CA1.1, CA1.3, CA1.4); null si puede quedarse. */
function destinoObligado(ruta: string, sesion: ReturnType<typeof useSesion>): string | null {
  if (sesion.tipo === 'cargando') return null;
  if (sesion.tipo === 'sin-sesion') return ruta === '/entrar' ? null : '/entrar';
  if (necesitaSegundoFactor(sesion.sesion)) return ruta === '/entrar/mfa' ? null : '/entrar/mfa';
  if (debeCambiarContrasena(sesion.sesion)) return ruta === '/cambiar-contrasena' ? null : '/cambiar-contrasena';
  if (ruta === '/cambiar-contrasena' || ruta in PAGINAS) return null;
  return RUTA_INICIO;
}

function ConSesion() {
  const { ruta } = useRuta();
  const sesion = useSesion();
  const conectado = sesion.tipo === 'con-sesion';
  const destino = destinoObligado(ruta, sesion);

  useEffect(() => {
    if (destino) navegar(destino, true);
  }, [destino]);

  // Cierre por inactividad (SPEC CA1.5)
  useEffect(() => {
    if (!conectado) return;
    return vigilarInactividad(MINUTOS_INACTIVIDAD_DEFECTO, () => void cerrarSesion('inactividad'));
  }, [conectado]);

  if (sesion.tipo === 'cargando' || destino) return <p class="cargando">Cargando…</p>;
  if (sesion.tipo === 'sin-sesion') return <Entrar />;
  if (ruta === '/entrar/mfa') return <SegundoPaso />;
  if (ruta === '/cambiar-contrasena') {
    return <CambiarContrasena obligatoria={debeCambiarContrasena(sesion.sesion)} />;
  }

  const pagina = PAGINAS[ruta];
  return <Layout ruta={ruta}>{pagina ? pagina() : null}</Layout>;
}
