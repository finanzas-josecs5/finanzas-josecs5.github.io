import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { limpiarCodigo, necesitaSegundoFactor, nivelDeSesion, qrComoBlob, tieneSegundoFactor } from '../../src/acceso/mfa';

function token(carga: object): string {
  return `cabecera.${Buffer.from(JSON.stringify(carga)).toString('base64url')}.firma`;
}

function sesion(aal: string, factores: { status: string }[]): Session {
  return { access_token: token({ aal }), user: { factors: factores } } as unknown as Session;
}

describe('mfa', () => {
  it('lee el nivel de garantía del token', () => {
    expect(nivelDeSesion(sesion('aal2', []))).toBe('aal2');
    expect(nivelDeSesion(sesion('aal1', []))).toBe('aal1');
    expect(nivelDeSesion({ access_token: 'basura', user: {} } as unknown as Session)).toBe('aal1');
  });

  it('pide el segundo factor solo si hay uno verificado y la sesión es aal1', () => {
    expect(necesitaSegundoFactor(sesion('aal1', [{ status: 'verified' }]))).toBe(true);
    expect(necesitaSegundoFactor(sesion('aal2', [{ status: 'verified' }]))).toBe(false);
    expect(necesitaSegundoFactor(sesion('aal1', [{ status: 'unverified' }]))).toBe(false);
    expect(tieneSegundoFactor({ access_token: '', user: {} } as unknown as Session)).toBe(false);
  });

  it('convierte el QR de Supabase en un Blob SVG (sin data: en la CSP)', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    for (const qr of [`data:image/svg+xml;utf-8,${svg}`, `data:image/svg+xml,${encodeURIComponent(svg)}`]) {
      const blob = qrComoBlob(qr);
      expect(blob.type).toBe('image/svg+xml');
      expect(await blob.text()).toBe(svg);
    }
  });

  it('deja solo las 6 cifras del código', () => {
    expect(limpiarCodigo(' 123 456 ')).toBe('123456');
    expect(limpiarCodigo('1234567')).toBe('123456');
  });
});
