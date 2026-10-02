import { erroresAxe, expect, sinProblemas, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba } from './supabase';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

test('F11: consejos explicados y accesibles con teclado (CA11.2)', async ({ page, problemas }) => {
  const usuario = await crearUsuario();
  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(usuario.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);

  // Un fondo con TER alto basta para provocar un consejo
  await page.goto('/#/fondos/nuevo');
  await page.getByLabel('Nombre').fill('Fondo caro');
  await page.getByLabel('ISIN').fill('IE00B4L5Y983');
  await page.getByLabel('TER (%)').fill('1,5');
  await page.getByRole('button', { name: 'Guardar fondo' }).click();
  await expect(page.getByRole('heading', { name: 'Fondo caro' })).toBeVisible();

  await page.goto('/#/consejos');
  const consejo = page.getByRole('article', { name: 'El TER de Fondo caro es alto para un indexado' });
  await expect(consejo).toBeVisible();

  // «¿En qué se basa?» se abre con el teclado y muestra datos, cálculo y umbral
  await consejo.getByText('¿En qué se basa?').focus();
  await page.keyboard.press('Enter');
  await expect(consejo.locator('.consejo__detalle')).toBeVisible();
  await expect(consejo.locator('.consejo__detalle')).toContainText('TER de Fondo caro: 1,50 %');
  await expect(consejo.locator('.consejo__detalle')).toContainText('TER superior al 0,50 %');
  for (const tema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: tema });
    expect(await erroresAxe(page)).toEqual([]);
  }

  // También aparece en el Resumen
  await page.goto('/#/resumen');
  await expect(page.getByRole('article', { name: 'El TER de Fondo caro es alto para un indexado' })).toBeVisible();
  await sinProblemas(page, problemas);
});
