// Trusted Types (SPEC S12): tesseract.js crea su worker con `new Worker(cadena)`, que es
// un sumidero protegido. La política «default» solo deja pasar la URL exacta del worker
// propio; cualquier otra URL, HTML o script sigue bloqueado.
export const URL_WORKER_OCR = '/ocr/worker.min.js';

let registrada = false;

export function registrarPoliticaOcr(): void {
  if (registrada || !('trustedTypes' in window)) return;
  const permitida = new URL(URL_WORKER_OCR, window.location.origin).href;
  window.trustedTypes.createPolicy('default', {
    createScriptURL: (url: string) => (url === permitida ? url : null),
  });
  registrada = true;
}
