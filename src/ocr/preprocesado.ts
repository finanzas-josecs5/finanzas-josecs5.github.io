// Preparación de la imagen antes del OCR (SPEC §4.5): más pequeña (más rápido en el móvil),
// en escala de grises y con el contraste estirado (los tickets térmicos salen desvaídos).
// Todo ocurre en memoria: la imagen nunca sale del navegador.

export const LADO_MAXIMO = 1600;

/** Tamaño reducido conservando la proporción; nunca amplía. */
export function tamanoReducido(ancho: number, alto: number, maximo = LADO_MAXIMO): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto);
  if (mayor <= maximo) return { ancho, alto };
  const factor = maximo / mayor;
  return { ancho: Math.max(1, Math.round(ancho * factor)), alto: Math.max(1, Math.round(alto * factor)) };
}

/**
 * Pasa a gris (luminancia BT.601) y estira el contraste al rango 0–255, en el sitio.
 * `pixeles` es RGBA, como el de ImageData.
 */
export function grisConContraste(pixeles: Uint8ClampedArray): void {
  let minimo = 255;
  let maximo = 0;
  for (let i = 0; i < pixeles.length; i += 4) {
    const gris = Math.round(0.299 * (pixeles[i] ?? 0) + 0.587 * (pixeles[i + 1] ?? 0) + 0.114 * (pixeles[i + 2] ?? 0));
    pixeles[i] = gris;
    if (gris < minimo) minimo = gris;
    if (gris > maximo) maximo = gris;
  }
  const rango = maximo - minimo;
  for (let i = 0; i < pixeles.length; i += 4) {
    const gris = pixeles[i] ?? 0;
    const estirado = rango > 0 ? Math.round(((gris - minimo) * 255) / rango) : gris;
    pixeles[i] = estirado;
    pixeles[i + 1] = estirado;
    pixeles[i + 2] = estirado;
  }
}

/** Decodifica, reduce y mejora una imagen. Falla con un mensaje claro si el formato no se puede leer. */
export async function prepararImagen(archivo: Blob): Promise<Blob> {
  let mapa: ImageBitmap;
  try {
    mapa = await createImageBitmap(archivo);
  } catch {
    throw new Error('No se puede leer este formato de imagen. Prueba con una captura de pantalla o una foto en JPEG.');
  }
  const { ancho, alto } = tamanoReducido(mapa.width, mapa.height);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d', { willReadFrequently: true });
  if (!contexto) throw new Error('Este navegador no permite preparar la imagen.');
  contexto.drawImage(mapa, 0, 0, ancho, alto);
  mapa.close();
  const datos = contexto.getImageData(0, 0, ancho, alto);
  grisConContraste(datos.data);
  contexto.putImageData(datos, 0, 0);
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se ha podido preparar la imagen.'))), 'image/png'),
  );
}
