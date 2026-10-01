/**
 * Content-Security-Policy de producción (SPEC §8.3, S12).
 * Se inyecta como <meta> en el build; en desarrollo no se aplica porque
 * el servidor de Vite necesita scripts inline para el HMR.
 */
export function construirCsp(supabaseUrl?: string): string {
  const conexiones = ["'self'"];
  if (supabaseUrl) conexiones.push(new URL(supabaseUrl).origin);

  const directivas: Record<string, string[]> = {
    'default-src': ["'none'"],
    // 'wasm-unsafe-eval' solo habilita WebAssembly (motor OCR), no eval() de JS
    'script-src': ["'self'", "'wasm-unsafe-eval'"],
    'style-src': ["'self'"],
    'img-src': ["'self'", 'blob:'],
    'font-src': ["'self'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
    'connect-src': conexiones,
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
    'object-src': ["'none'"],
    'require-trusted-types-for': ["'script'"],
    'trusted-types': ['default'],
    'upgrade-insecure-requests': [],
  };

  return Object.entries(directivas)
    .map(([nombre, valores]) => [nombre, ...valores].join(' '))
    .join('; ');
}
