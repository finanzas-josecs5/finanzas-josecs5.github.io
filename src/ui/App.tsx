import { useEffect } from 'preact/hooks';
import { CambiarContrasena } from '../acceso/CambiarContrasena';
import { Entrar } from '../acceso/Entrar';
import { MINUTOS_INACTIVIDAD_DEFECTO, vigilarInactividad } from '../acceso/inactividad';
import { cerrarSesion, debeCambiarContrasena, useSesion } from '../acceso/sesion';
import { backendConfigurado } from '../datos/cliente';
import { LabOcr } from './LabOcr';
import { Layout } from './Layout';
import { Pendiente } from './Pendiente';
import { navegar, RUTA_INICIO, useRuta } from './router';

const PAGINAS: Record<string, string> = {
  '/resumen': 'Resumen',
  '/movimientos': 'Movimientos',
  '/movimientos/nuevo': 'Añadir gasto',
  '/comun': 'Común',
  '/fondos': 'Fondos',
  '/simulador': 'Simulador',
  '/ajustes': 'Ajustes',
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

function ConSesion() {
  const { ruta, consulta } = useRuta();
  const sesion = useSesion();
  const conectado = sesion.tipo === 'con-sesion';
  const cambiarPrimero = conectado && debeCambiarContrasena(sesion.sesion);

  // Redirecciones (SPEC CA1.1 y CA1.3)
  let destino: string | null = null;
  if (sesion.tipo === 'sin-sesion' && ruta !== '/entrar') destino = '/entrar';
  if (conectado && cambiarPrimero && ruta !== '/cambiar-contrasena') destino = '/cambiar-contrasena';
  if (conectado && !cambiarPrimero && (ruta === '/entrar' || !(ruta in PAGINAS || ruta === '/cambiar-contrasena'))) {
    destino = RUTA_INICIO;
  }
  useEffect(() => {
    if (destino) navegar(destino, true);
  }, [destino]);

  // Cierre por inactividad (SPEC CA1.5)
  useEffect(() => {
    if (!conectado) return;
    return vigilarInactividad(MINUTOS_INACTIVIDAD_DEFECTO, () => void cerrarSesion('inactividad'));
  }, [conectado]);

  if (sesion.tipo === 'cargando' || destino) return <p class="cargando">Cargando…</p>;
  if (sesion.tipo === 'sin-sesion') return <Entrar motivo={consulta.get('motivo')} />;
  if (ruta === '/cambiar-contrasena') return <CambiarContrasena obligatoria={cambiarPrimero} />;

  return (
    <Layout ruta={ruta}>
      <Pendiente titulo={PAGINAS[ruta] ?? 'Finanzas'} />
    </Layout>
  );
}
