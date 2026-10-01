// Clave estable para recordar «comercio → categoría» (SPEC §4.4, CA4.2).
const FORMAS_JURIDICAS = new Set(['sa', 'sl', 'slu', 'sau', 'sll', 'scoop', 'cb', 'sc']);

export function normalizarComercio(nombre: string): string {
  const palabras = nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\.(?=\S)/g, '') // «s.a.» → «sa.»: las siglas con puntos quedan unidas
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (palabras.length > 1 && FORMAS_JURIDICAS.has(palabras.at(-1) ?? '')) palabras.pop();
  return palabras.join(' ');
}
