import type { Session } from '@supabase/supabase-js';

// Verificación en dos pasos (TOTP) opcional por usuario (SPEC S9, CA1.4).
// La base de datos ya exige aal2 si hay un factor verificado; esto solo guía la interfaz.

/** Nivel de garantía (aal1/aal2) que lleva el token de acceso. */
export function nivelDeSesion(sesion: Session): 'aal1' | 'aal2' {
  try {
    const carga = sesion.access_token.split('.')[1] ?? '';
    const base64 = carga.replace(/-/g, '+').replace(/_/g, '/');
    const datos = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { aal?: unknown };
    return datos.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

export function tieneSegundoFactor(sesion: Session): boolean {
  return (sesion.user.factors ?? []).some((f) => f.status === 'verified');
}

export function necesitaSegundoFactor(sesion: Session): boolean {
  return tieneSegundoFactor(sesion) && nivelDeSesion(sesion) !== 'aal2';
}

/**
 * Supabase entrega el QR como «data:image/svg+xml;…,<svg…>». La CSP no admite data: en
 * img-src, así que se convierte en un Blob local (blob: sí está permitido). Una imagen SVG
 * dentro de <img> no puede ejecutar scripts.
 */
export function qrComoBlob(qr: string): Blob {
  const coma = qr.indexOf(',');
  const contenido = coma >= 0 ? qr.slice(coma + 1) : qr;
  let svg = contenido;
  if (!contenido.trimStart().startsWith('<')) {
    try {
      svg = decodeURIComponent(contenido);
    } catch {
      svg = contenido;
    }
  }
  return new Blob([svg], { type: 'image/svg+xml' });
}

/** Solo 6 cifras, quitando espacios que pegan algunas apps. */
export function limpiarCodigo(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, 6);
}
