// Iconos SVG propios (sin librerías ni fuentes externas). Siempre decorativos:
// el texto visible o aria-label de su contenedor es lo que leen los lectores de pantalla.
const TRAZOS = {
  resumen: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  movimientos: 'M4 6h16M4 12h16M4 18h10',
  comun: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5',
  fondos: 'M4 20V10m6 10V4m6 16v-7m6 7H2',
  simulador: 'M3 17l5-5 4 4 8-9M14 7h6v6',
  mas: 'M12 5v14M5 12h14',
  ajustes:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.5a7.6 7.6 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1c.7.6 1.4 1 2.2 1.3l.4 2.5h4l.4-2.5c.8-.3 1.5-.7 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z',
  salir: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10',
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre }: { nombre: NombreIcono }) {
  return (
    <svg class="icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
