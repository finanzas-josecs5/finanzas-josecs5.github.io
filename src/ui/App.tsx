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
import { AjustesNomina } from '../ajustes/Nomina';
import { Historico } from './Historico';
import { Resumen } from './Resumen';
import { backendConfigurado } from '../datos/cliente';
import { LabOcr } from './LabOcr';
import { Layout } from './Layout';
import { Pendiente } from './Pendiente';
import { coincide, navegar, RUTA_INICIO, useRuta } from './router';
import { DetalleMovimiento } from '../movimientos/Detalle';
import { ListaMovimientos } from '../movimientos/Lista';
import { NuevoMovimiento } from '../movimientos/Nuevo';
import { EditarRecurrente, ListaRecurrentes } from '../movimientos/Recurrentes';

/** Páginas dentro del marco de la app (con navegación). Las fijas van antes que las de parámetros. */
const PAGINAS: [string, (p: Record<string, string>) => ComponentChildren][] = [
  ['/resumen', () => <Resumen />],
  ['/resumen/historico', () => <Historico />],
  ['/movimientos', () => <ListaMovimientos />],
  ['/movimientos/nuevo', () => <NuevoMovimiento />],
  ['/movimientos/:id', (p) => <DetalleMovimiento id={p.id ?? ''} />],
  ['/recurrentes', () => <ListaRecurrentes />],
  ['/recurrentes/nuevo', () => <EditarRecurrente id={null} />],
  ['/recurrentes/:id', (p) => <EditarRecurrente id={p.id ?? null} />],
  ['/comun', () => <Pendiente titulo="Común" />],
  ['/fondos', () => <Pendiente titulo="Fondos" />],
  ['/simulador', () => <Pendiente titulo="Simulador" />],
  ['/ajustes', () => <Ajustes />],
  ['/ajustes/seguridad', () => <Seguridad />],
  ['/ajustes/nomina', () => <AjustesNomina />],
];

function resolverPagina(ruta: string): ComponentChildren | null {
  for (const [patron, pagina] of PAGINAS) {
    const params = coincide(patron, ruta);
    if (params) return pagina(params);
  }
  return null;
}

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
  if (ruta === '/cambiar-contrasena' || resolverPagina(ruta) !== null) return null;
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

  return <Layout ruta={ruta}>{resolverPagina(ruta)}</Layout>;
}
