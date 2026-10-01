import type { Page } from '@playwright/test';
import { erroresAxe, expect, hayScrollHorizontal, sinProblemas, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba, type UsuarioPrueba } from './supabase';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

async function entrar(page: Page, usuario: UsuarioPrueba, contrasena = usuario.contrasena) {
  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('CA1.1: sin sesión cualquier ruta lleva a Entrar', async ({ page, problemas }) => {
  await page.goto('/#/movimientos');
  await expect(page).toHaveURL(/#\/entrar$/);
  await expect(page.getByRole('heading', { name: 'Finanzas' })).toBeVisible();
  expect(await erroresAxe(page)).toEqual([]);
  await sinProblemas(page, problemas);
});

test('contraseña incorrecta: mensaje claro y sin sesión', async ({ page }) => {
  const usuario = await crearUsuario();
  await entrar(page, usuario, 'No-es-la-buena-1!');
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.');
  await expect(page).toHaveURL(/#\/entrar$/);
});

test('CA1.3: el primer acceso obliga a cambiar la contraseña', async ({ page, problemas }) => {
  const usuario = await crearUsuario({ primerAcceso: true });
  await entrar(page, usuario);
  await expect(page).toHaveURL(/#\/cambiar-contrasena$/);
  await expect(page.getByRole('heading', { name: 'Elige tu contraseña' })).toBeVisible();

  // No puede saltarse el paso
  await page.goto('/#/resumen');
  await expect(page).toHaveURL(/#\/cambiar-contrasena$/);

  // Requisitos explicados en español
  await page.getByLabel('Nueva contraseña').fill('corta');
  await page.getByLabel('Repite la contraseña').fill('corta');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText('al menos 12 caracteres');

  const nueva = 'Mi-clave-nueva-2026!';
  await page.getByLabel('Nueva contraseña').fill(nueva);
  await page.getByLabel('Repite la contraseña').fill(nueva);
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();

  // Su espacio individual existe y la sesión sobrevive a una recarga
  await page.reload();
  await expect(page.getByLabel('Espacio')).toHaveValue(/.+/);
  await expect(page.getByLabel('Espacio').locator('option')).toHaveText(['Yo']);
  await sinProblemas(page, problemas);
});

test('CA1.5: tras 30 minutos sin uso se cierra la sesión', async ({ page }) => {
  const usuario = await crearUsuario();
  await page.clock.install();
  await entrar(page, usuario);
  await expect(page).toHaveURL(/#\/resumen$/);

  await page.clock.fastForward('29:00');
  await expect(page).toHaveURL(/#\/resumen$/);

  await page.clock.fastForward('02:00');
  await expect(page).toHaveURL(/#\/entrar$/);
  await expect(page.getByRole('status')).toHaveText('Se ha cerrado la sesión tras 30 minutos sin uso.');
  expect(await page.evaluate(() => localStorage.getItem('finanzas-sesion'))).toBeNull();

  // La sesión ya no existe: volver atrás no da acceso
  await page.goto('/#/resumen');
  await expect(page).toHaveURL(/#\/entrar$/);
});

test('layout responsive, accesible y con cierre de sesión', async ({ page, problemas }, info) => {
  const usuario = await crearUsuario();
  await entrar(page, usuario);
  await expect(page).toHaveURL(/#\/resumen$/);

  const navegacion = page.getByRole('navigation', { name: 'Principal' });
  await expect(navegacion.getByRole('link')).toHaveText(['Resumen', 'Movimientos', 'Común', 'Fondos', 'Simulador']);
  await expect(navegacion.getByRole('link', { name: 'Resumen' })).toHaveAttribute('aria-current', 'page');

  const caja = await navegacion.boundingBox();
  const ventana = page.viewportSize();
  if (!caja || !ventana) throw new Error('Sin dimensiones');
  if (info.project.name === 'movil-375') {
    expect(caja.y + caja.height).toBeGreaterThan(ventana.height - 2); // barra inferior
    expect(caja.width).toBeGreaterThan(ventana.width - 2);
  } else {
    expect(caja.x).toBeLessThan(1); // barra lateral
    expect(caja.width).toBeLessThan(info.project.name === 'tablet-768' ? 120 : 260);
  }

  // RWD2: destinos táctiles de al menos 44 px
  for (const enlace of await navegacion.getByRole('link').all()) {
    const b = await enlace.boundingBox();
    expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  expect(await hayScrollHorizontal(page)).toBe(false);
  for (const tema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: tema });
    expect(await erroresAxe(page)).toEqual([]);
  }

  await navegacion.getByRole('link', { name: 'Fondos' }).click();
  await expect(page).toHaveURL(/#\/fondos$/);
  await expect(page.getByRole('heading', { name: 'Fondos' })).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/#\/entrar$/);
  await sinProblemas(page, problemas);
});
