// Validación de un ISIN (ISO 6166, SPEC CA8.1): 2 letras de país, 9 alfanuméricos y un dígito
// de control calculado con Luhn sobre la cadena con las letras convertidas (A = 10 … Z = 35).

export function normalizarIsin(texto: string): string {
  return texto.replace(/\s/g, '').toUpperCase();
}

export function esIsinValido(texto: string): boolean {
  const isin = normalizarIsin(texto);
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  const digitos = [...isin].map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c)).join('');
  let suma = 0;
  // Luhn: desde la derecha, se duplica una cifra sí y otra no empezando por la segunda
  for (let i = 0; i < digitos.length; i += 1) {
    let cifra = Number(digitos[digitos.length - 1 - i]);
    if (i % 2 === 1) {
      cifra *= 2;
      if (cifra > 9) cifra -= 9;
    }
    suma += cifra;
  }
  return suma % 10 === 0;
}
