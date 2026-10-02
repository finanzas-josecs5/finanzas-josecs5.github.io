import type { Worker as WorkerOcr } from 'tesseract.js';
import { registrarPoliticaOcr, URL_WORKER_OCR } from './tt-policy';

let trabajador: Promise<WorkerOcr> | undefined;

/** Crea (una sola vez) el worker de Tesseract con todos los recursos servidos desde /ocr/. */
function obtenerTrabajador(): Promise<WorkerOcr> {
  trabajador ??= (async () => {
    registrarPoliticaOcr();
    // Import dinámico: el motor solo se descarga cuando se usa (SPEC §4.5)
    const { createWorker, OEM } = await import('tesseract.js');
    return createWorker('spa', OEM.LSTM_ONLY, {
      workerPath: URL_WORKER_OCR,
      workerBlobURL: false,
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      gzip: true,
    });
  })().catch((error: unknown) => {
    // Si falla la descarga (sin conexión), el siguiente intento vuelve a empezar
    trabajador = undefined;
    throw error instanceof Error ? error : new Error('No se ha podido cargar el lector de tickets.');
  });
  return trabajador;
}

export async function reconocerTexto(imagen: Blob): Promise<string> {
  const ocr = await obtenerTrabajador();
  const { data } = await ocr.recognize(imagen);
  return data.text;
}
