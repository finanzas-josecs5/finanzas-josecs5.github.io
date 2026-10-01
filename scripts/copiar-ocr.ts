// Copia el motor OCR (worker, núcleo WASM y modelo de español) a public/ocr para
// servirlo desde el propio sitio: sin CDN (SPEC S12). Se ejecuta antes de dev y build.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const destino = join('public', 'ocr');
const copias: [string, string][] = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // Solo núcleos LSTM (oem 1): con y sin SIMD, según lo que admita el navegador
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  // Modelo «best_int»: más preciso que «fast» y bastante más ligero que «best» (~2 MB comprimido)
  ['node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', 'lang/spa.traineddata.gz'],
];

for (const [origen, relativo] of copias) {
  const ruta = join(destino, relativo);
  mkdirSync(join(ruta, '..'), { recursive: true });
  copyFileSync(origen, ruta);
}
console.log(`copiar-ocr: ${copias.length} archivos en ${destino}`);
