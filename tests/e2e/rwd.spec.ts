import { erroresAxe, expect, hayScrollHorizontal, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba } from './supabase';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

// RWD5 (WCAG 1.4.10): a 320 px de ancho (equivale a 1280 px con zoom al 400 %) todo se reajusta
// sin scroll horizontal; y RWD2: los enlaces de navegación miden al menos 44 px de alto.
const PAGINAS = ['/resumen', '/resumen/historico', '/movimientos', '/movimientos/nuevo', '/comun', '/fondos', '/simulador', '/consejos', '/ajustes'];

test('RWD5: reflujo a 320 px en todas las pantallas principales', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil-375', 'Basta con una pasada a 320 px');
  test.setTimeout(120_000);
  const usuario = await crearUsuario();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(usuario.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);

  for (const ruta of PAGINAS) {
    await page.goto(`/#${ruta}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.cargando')).toHaveCount(0);
    expect(await hayScrollHorizontal(page), `scroll horizontal en ${ruta}`).toBe(false);
    expect(await erroresAxe(page), `axe en ${ruta}`).toEqual([]);
  }

  for (const enlace of await page.getByRole('navigation', { name: 'Principal' }).getByRole('link').all()) {
    expect((await enlace.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});
