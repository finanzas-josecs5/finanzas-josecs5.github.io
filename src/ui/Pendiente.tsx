// Marcador de las secciones que todavía no están construidas (se sustituyen tarea a tarea).
export function Pendiente({ titulo }: { titulo: string }) {
  return (
    <section>
      <h1>{titulo}</h1>
      <p class="nota">Esta sección estará disponible pronto.</p>
    </section>
  );
}
