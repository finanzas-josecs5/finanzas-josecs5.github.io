import { defineConfig, loadEnv, type Plugin } from 'vite';
import { construirCsp } from './config/csp.ts';

function cspMeta(supabaseUrl?: string): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      // Justo después de <meta charset>, antes de cualquier script o estilo
      handler: (html) => {
        const meta = `<meta http-equiv="Content-Security-Policy" content="${construirCsp(supabaseUrl)}" />`;
        const marcador = '<meta charset="UTF-8" />';
        if (!html.includes(marcador)) throw new Error('index.html debe tener <meta charset="UTF-8" />');
        return html.replace(marcador, `${marcador}\n    ${meta}`);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: '/',
    plugins: [cspMeta(env.VITE_SUPABASE_URL || undefined)],
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    build: { target: 'es2023', sourcemap: false },
    test: {
      include: ['tests/unit/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts', 'config/**/*.ts'],
        exclude: ['src/**/*.tsx', 'src/**/*.d.ts'],
        // SPEC §11: ≥ 90 % en los módulos de cálculo (se amplía con cada módulo)
        thresholds: {
          'src/nucleo/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
          'src/movimientos/recurrencias.ts': { lines: 90, branches: 90, functions: 90, statements: 90 },
          'src/movimientos/calculos.ts': { lines: 90, branches: 90, functions: 90, statements: 90 },
        },
      },
    },
  };
});
