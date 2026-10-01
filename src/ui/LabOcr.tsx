import { useState } from 'preact/hooks';
import { reconocerTexto } from '../ocr/motor';

// Página temporal de la prueba de concepto (T4). Se elimina en T17.
export function LabOcr() {
  const [estado, setEstado] = useState('Elige una imagen');
  const [texto, setTexto] = useState('');

  async function alElegir(e: Event) {
    const archivo = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!archivo) return;
    setEstado(`Leyendo ${archivo.name} (${archivo.type || 'tipo desconocido'})…`);
    const inicio = performance.now();
    try {
      setTexto(await reconocerTexto(archivo));
      setEstado(`Listo en ${Math.round(performance.now() - inicio)} ms`);
    } catch (error) {
      setEstado(`Error: ${String(error)}`);
    }
  }

  return (
    <main class="contenedor">
      <h1>Laboratorio OCR</h1>
      <label>
        Imagen del ticket{' '}
        <input type="file" accept="image/*" onChange={(e) => void alElegir(e)} />
      </label>
      <p role="status" data-testid="estado">
        {estado}
      </p>
      <pre data-testid="texto">{texto}</pre>
    </main>
  );
}
