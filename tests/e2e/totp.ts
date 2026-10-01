import { createHmac } from 'node:crypto';

// Generador TOTP (RFC 6238, SHA-1, 6 cifras, 30 s) para simular la app de autenticación en los e2e.
function base32(secreto: string): Buffer {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secreto.replace(/=+$/, '').toUpperCase()) {
    const valor = alfabeto.indexOf(c);
    if (valor < 0) throw new Error(`Carácter base32 inválido: ${c}`);
    bits += valor.toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

export function codigoTotp(secreto: string, ahora = Date.now()): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(ahora / 30_000)));
  const hmac = createHmac('sha1', base32(secreto)).update(contador).digest();
  const desplazamiento = (hmac[hmac.length - 1] ?? 0) & 0xf;
  const numero = hmac.readUInt32BE(desplazamiento) & 0x7fffffff;
  return String(numero % 1_000_000).padStart(6, '0');
}
