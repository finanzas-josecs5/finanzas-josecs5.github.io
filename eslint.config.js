import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nounsanitized from 'eslint-plugin-no-unsanitized';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/', 'public/ocr/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  nounsanitized.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // SPEC S13: nunca renderizar como HTML lo que introduce el usuario
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Prohibido: no se renderiza HTML (SPEC S13).',
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'document', property: 'write', message: 'Prohibido (SPEC S13).' },
        { object: 'document', property: 'writeln', message: 'Prohibido (SPEC S13).' },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
