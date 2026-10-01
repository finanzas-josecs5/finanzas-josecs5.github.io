import { describe, expect, it } from 'vitest';
import { codigoTotp } from '../e2e/totp';

// Vectores de prueba del RFC 6238 (SHA-1, secreto ASCII «12345678901234567890»), recortados a 6 cifras
const SECRETO_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('generador TOTP de los e2e', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('t=%i → %s', (segundos, esperado) => {
    expect(codigoTotp(SECRETO_RFC, segundos * 1000)).toBe(esperado);
  });
});
