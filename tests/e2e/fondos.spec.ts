import { erroresAxe, expect, hayScrollHorizontal, sinProblemas, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba } from './supabase';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

const NBSP = String.fromCharCode(0xa0);

test('F8: fondo con ISIN validado, aportación, valor, plusvalía y TIR (CA8.1, CA8.2)', async ({ page, problemas }) => {
  const usuario = await crearUsuario();
  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(usuario.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);

  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Fondos' }).click();
  await page.getByRole('link', { name: 'Añade el primero' }).click();

  // CA8.1: ISIN con el dígito de control mal
  await page.getByLabel('Nombre').fill('MSCI World');
  await page.getByLabel('ISIN').fill('IE00B4L5Y984');
  await page.getByLabel('TER (%)').fill('0,2');
  await page.getByRole('button', { name: 'Guardar fondo' }).click();
  await expect(page.getByRole('alert')).toContainText('El ISIN no es válido');
  await page.getByLabel('ISIN').fill('ie00 b4l5 y983');
  await page.getByRole('button', { name: 'Guardar fondo' }).click();
  await expect(page.getByRole('heading', { name: 'MSCI World' })).toBeVisible();
  await expect(page.getByText('IE00B4L5Y983')).toBeVisible();

  // Aportación de 1.000 € el 1/1/2025 y valor de 1.100 € el 1/1/2026
  await page.getByLabel('Importe aportado (€)').fill('1.000');
  await page.getByLabel('Fecha de la aportación').fill('2025-01-01');
  await page.getByRole('button', { name: 'Añadir aportación' }).click();
  await expect(page.getByRole('region', { name: 'Aportaciones' })).toContainText(`1.000,00${NBSP}€`);

  await page.getByRole('link', { name: 'Actualizar valor' }).click();
  await page.getByLabel('Valor actual (€)').fill('1.100');
  await page.getByLabel('Fecha del valor').fill('2026-01-01');
  await page.getByRole('button', { name: 'Guardar valor' }).click();

  // CA8.2: plusvalía +100,00 € y TIR del 10 %
  const datos = page.locator('.datos');
  await expect(datos).toContainText(`+100,00${NBSP}€`);
  await expect(datos.locator('div', { hasText: 'TIR anual' })).toContainText(`10${NBSP}%`);
  await expect(datos.locator('div', { hasText: 'Coste TER' })).toContainText(`2,20${NBSP}€/año`);
  await expect(page.getByRole('group', { name: 'MSCI World' }).getByRole('button')).toHaveCount(1);
  expect(await hayScrollHorizontal(page)).toBe(false);
  for (const tema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: tema });
    expect(await erroresAxe(page)).toEqual([]);
  }

  // En la lista, la cartera completa
  await page.getByRole('link', { name: '‹ Fondos' }).click();
  await expect(page.getByTestId('valor-cartera')).toHaveText(`1.100,00${NBSP}€`);
  await expect(page.getByRole('link', { name: /MSCI World/ })).toContainText('TIR 10');

  await sinProblemas(page, problemas);
});
