import type { ComponentChildren } from 'preact';
import { cerrarSesion } from '../acceso/sesion';
import { SelectorEspacio } from '../espacios/SelectorEspacio';
import { Icono, type NombreIcono } from './iconos';

const SECCIONES: { ruta: string; texto: string; icono: NombreIcono }[] = [
  { ruta: '/resumen', texto: 'Resumen', icono: 'resumen' },
  { ruta: '/movimientos', texto: 'Movimientos', icono: 'movimientos' },
  { ruta: '/comun', texto: 'Común', icono: 'comun' },
  { ruta: '/fondos', texto: 'Fondos', icono: 'fondos' },
  { ruta: '/simulador', texto: 'Simulador', icono: 'simulador' },
];

// SPEC §9: barra inferior (< 768 px), lateral compacta (768–1279 px) y lateral completa (≥ 1280 px)
export function Layout({ ruta, children }: { ruta: string; children: ComponentChildren }) {
  return (
    <div class="marco">
      <header class="cabecera">
        <span class="cabecera__titulo">Finanzas</span>
        <SelectorEspacio />
        <a class="boton-icono" href="#/ajustes" aria-label="Ajustes" aria-current={ruta.startsWith('/ajustes') ? 'page' : undefined}>
          <Icono nombre="ajustes" />
        </a>
        <button class="boton-icono" type="button" aria-label="Cerrar sesión" onClick={() => void cerrarSesion()}>
          <Icono nombre="salir" />
        </button>
      </header>

      <nav class="navegacion" aria-label="Principal">
        <ul>
          {SECCIONES.map((s) => (
            <li key={s.ruta}>
              <a href={`#${s.ruta}`} aria-current={ruta.startsWith(s.ruta) ? 'page' : undefined}>
                <Icono nombre={s.icono} />
                <span>{s.texto}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main class="contenido" id="contenido">
        {children}
      </main>

      <a class="boton-flotante" href="#/movimientos/nuevo" aria-label="Añadir gasto">
        <Icono nombre="mas" />
      </a>
    </div>
  );
}
