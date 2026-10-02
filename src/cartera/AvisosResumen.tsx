import { useEffect, useState } from 'preact/hooks';
import { listarFondos, movimientosCartera } from '../datos/repos/cartera';
import { listarLiquidez } from '../datos/repos/liquidez';
import { hoy } from '../nucleo/fechas';
import { ultimaValoracion } from './cartera';
import { recordatorios, type Recordatorio } from './recordatorios';

/** Avisos del Resumen de «Yo»: fondos y liquidez sin actualizar en más de 30 días (CA8.3, CA8.5). */
export function AvisosResumen() {
  const [lista, setLista] = useState<Recordatorio[]>([]);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarFondos(), movimientosCartera(), listarLiquidez()]).then(
      ([fondos, { valoraciones }, liquidez]) => {
        if (!vigente) return;
        const fondosConValor = fondos.map((f) => ({
          id: f.id,
          nombre: f.nombre,
          ultimaValoracion: ultimaValoracion(valoraciones.filter((v) => v.fondo_id === f.id))?.fecha ?? null,
        }));
        setLista(recordatorios(hoy(), fondosConValor, liquidez[0]?.fecha ?? null));
      },
      () => vigente && setLista([]),
    );
    return () => {
      vigente = false;
    };
  }, []);

  if (lista.length === 0) return null;
  return (
    <section class="aviso" aria-label="Recordatorios">
      <ul class="recordatorios">
        {lista.map((r) => (
          <li key={r.enlace}>
            <a href={r.enlace}>{r.texto}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
