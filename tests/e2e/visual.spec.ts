import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { abrir, entrar, expect, PAGINAS, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba } from './supabase';

// RWD6: capturas de referencia por pantalla y anchura. Se generan en el runner de CI (Linux):
// si falta una, el test falla y la deja en el artefacto «capturas-e2e» (carpeta referencias/)
// para añadirla a tests/e2e/visual.spec.ts-snapshots/. Para renovar una, se borra y se repite.
test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

// Sin reintentos: en el reintento la referencia ya existiría y el fallo pasaría como intermitente
test.describe.configure({ retries: 0 });

// Diferencia máxima tolerada: el 1 % de los píxeles
const UMBRAL = 0.01;
// Fecha fija en el pasado (el token de sesión sigue siendo válido) para que el mes no cambie
const AHORA = new Date('2026-09-15T10:00:00+02:00');

test('RWD6: las pantallas coinciden con sus capturas de referencia', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(AHORA);
  // La inflación del build cambia cada día: se sirve siempre la de respaldo
  await page.route('**/datos/ipc.json', (ruta) => ruta.fulfill({ path: 'src/simulador/ipc-respaldo.json' }));
  const usuario = await crearUsuario();

  const comparar = async (nombre: string) => {
    const referencia = info.snapshotPath(nombre, { kind: 'screenshot' });
    const faltaba = !existsSync(referencia);
    try {
      await expect.soft(page).toHaveScreenshot(nombre, {
        fullPage: true,
        maxDiffPixelRatio: UMBRAL,
        mask: [page.getByText(usuario.email)],
      });
    } finally {
      if (faltaba && existsSync(referencia)) {
        mkdirSync('capturas-e2e/referencias', { recursive: true });
        copyFileSync(referencia, `capturas-e2e/referencias/${basename(referencia)}`);
      }
    }
  };

  await page.goto('/#/entrar');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await comparar('entrar.png');

  await entrar(page, usuario);
  for (const ruta of PAGINAS) {
    await abrir(page, ruta);
    await comparar(`${ruta.slice(1).replaceAll('/', '-')}.png`);
  }
});
