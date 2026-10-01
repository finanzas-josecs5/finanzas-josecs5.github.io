import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

// Comprueba que las reglas de SPEC S13 siguen activas: si alguien las quita, este test falla.
// Los fragmentos no existen en disco, así que se desactiva el análisis con tipos;
// las reglas de seguridad no lo necesitan.
const eslint = new ESLint({
  cwd: process.cwd(),
  overrideConfig: [{ files: ['**/*.ts', '**/*.tsx'], ...tseslint.configs.disableTypeChecked }],
});

async function errores(codigo: string, archivo: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(codigo, { filePath: archivo });
  const mensajes = resultado?.messages ?? [];
  const fatal = mensajes.find((m) => m.fatal);
  if (fatal) throw new Error(`El fragmento no se pudo analizar: ${fatal.message}`);
  return mensajes.filter((m) => m.severity === 2).map((m) => m.ruleId ?? '');
}

describe('reglas de lint de seguridad', () => {
  it('prohíbe innerHTML', async () => {
    const reglas = await errores('export function f(e: HTMLElement, t: string) { e.innerHTML = t; }\n', 'src/prueba.ts');
    expect(reglas).toContain('no-unsanitized/property');
  });

  it('prohíbe dangerouslySetInnerHTML', async () => {
    const reglas = await errores(
      'export const X = (p: { t: string }) => <div dangerouslySetInnerHTML={{ __html: p.t }} />;\n',
      'src/prueba.tsx',
    );
    expect(reglas).toContain('no-restricted-syntax');
  });
});
