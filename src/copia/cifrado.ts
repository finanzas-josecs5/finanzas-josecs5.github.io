// Cifrado del archivo de exportación (SPEC §4.11, F12): AES-GCM 256 con una clave derivada de
// la contraseña con PBKDF2-SHA256 (600.000 iteraciones, mínimo de OWASP). Todo con WebCrypto:
// la contraseña y la clave nunca salen del navegador ni se guardan.
export const ITERACIONES = 600_000;

export interface Cifrado {
  formato: 'finanzas-personales';
  version: 1;
  cifrado: { alg: 'AES-GCM'; kdf: 'PBKDF2-SHA256'; iteraciones: number; salt: string; iv: string };
  datos: string;
}

/** Por bloques: con `fromCharCode(...bytes)` una copia grande desbordaría la pila */
function aBase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}
const deBase64 = (texto: string) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
/** WebCrypto (lib.dom de TS 6) exige un ArrayBuffer propio, no cualquier ArrayBufferLike */
const buffer = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer;

async function derivarClave(contrasena: string, salt: Uint8Array, iteraciones: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', buffer(new TextEncoder().encode(contrasena)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: buffer(salt), iterations: iteraciones },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function cifrar(texto: string, contrasena: string, iteraciones = ITERACIONES): Promise<Cifrado> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const clave = await derivarClave(contrasena, salt, iteraciones);
  const datos = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buffer(iv) }, clave, buffer(new TextEncoder().encode(texto))));
  return {
    formato: 'finanzas-personales',
    version: 1,
    cifrado: { alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iteraciones, salt: aBase64(salt), iv: aBase64(iv) },
    datos: aBase64(datos),
  };
}

export function estaCifrado(valor: unknown): valor is Cifrado {
  const v = valor as Partial<Cifrado> | null;
  return v?.formato === 'finanzas-personales' && typeof v.datos === 'string' && v.cifrado?.alg === 'AES-GCM';
}

/** Lanza un error claro si la contraseña es incorrecta o el archivo está dañado (GCM lo detecta). */
export async function descifrar(archivo: Cifrado, contrasena: string): Promise<string> {
  const { salt, iv, iteraciones } = archivo.cifrado;
  if (!(iteraciones >= 100_000 && iteraciones <= 10_000_000)) throw new Error('El archivo tiene parámetros de cifrado no válidos.');
  try {
    const clave = await derivarClave(contrasena, deBase64(salt), iteraciones);
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buffer(deBase64(iv)) }, clave, buffer(deBase64(archivo.datos)));
    return new TextDecoder().decode(claro);
  } catch {
    throw new Error('Contraseña incorrecta o archivo dañado.');
  }
}
