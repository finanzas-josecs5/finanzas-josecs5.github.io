import { useEffect, useState } from 'preact/hooks';

// Rutas con hash (#/…): GitHub Pages no tiene fallback de SPA (SPEC §5).
export const RUTA_INICIO = '/resumen';

export interface Ruta {
  ruta: string;
  consulta: URLSearchParams;
}

export function leerRuta(hash: string = window.location.hash): Ruta {
  const sinAlmohadilla = hash.replace(/^#/, '');
  const [camino = '', consulta = ''] = sinAlmohadilla.split('?');
  const ruta = camino.startsWith('/') && camino.length > 1 ? camino.replace(/\/+$/, '') : RUTA_INICIO;
  return { ruta, consulta: new URLSearchParams(consulta) };
}

export function navegar(ruta: string, reemplazar = false): void {
  const destino = `#${ruta}`;
  if (window.location.hash === destino) return;
  if (reemplazar) window.location.replace(destino);
  else window.location.hash = destino;
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState(() => leerRuta());
  useEffect(() => {
    const alCambiar = () => setRuta(leerRuta());
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);
  return ruta;
}

/** «/fondos/:id» contra «/fondos/abc» → { id: 'abc' }; null si no coincide. */
export function coincide(patron: string, ruta: string): Record<string, string> | null {
  const p = patron.split('/');
  const r = ruta.split('/');
  if (p.length !== r.length) return null;
  const params: Record<string, string> = {};
  for (const [i, trozo] of p.entries()) {
    const valor = r[i] ?? '';
    if (trozo.startsWith(':')) {
      if (!valor) return null;
      params[trozo.slice(1)] = decodeURIComponent(valor);
    } else if (trozo !== valor) {
      return null;
    }
  }
  return params;
}
