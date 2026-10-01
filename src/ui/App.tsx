import { LabOcr } from './LabOcr';

export function App() {
  if (window.location.hash === '#/lab/ocr') return <LabOcr />;
  return (
    <main class="contenedor">
      <h1>Finanzas</h1>
      <p>Esqueleto listo. Aún no hay datos.</p>
    </main>
  );
}
