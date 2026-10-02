// Índice de ajustes (SPEC §5). Cada apartado se añade con su tarea.
const APARTADOS = [
  { ruta: '/ajustes/nomina', texto: 'Nómina', detalle: '12 o 14 pagas, netos y prorrateo' },
  { ruta: '/ajustes/espacios', texto: 'Espacios', detalle: 'Pareja y Piso: crearlos y compartirlos' },
  { ruta: '/ajustes/seguridad', texto: 'Seguridad', detalle: 'Contraseña y verificación en dos pasos' },
];

export function Ajustes() {
  return (
    <section>
      <h1>Ajustes</h1>
      <ul class="lista-enlaces">
        {APARTADOS.map((a) => (
          <li key={a.ruta}>
            <a class="tarjeta" href={`#${a.ruta}`}>
              <strong>{a.texto}</strong>
              <span class="nota">{a.detalle}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
