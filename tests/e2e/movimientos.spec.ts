import type { Page } from '@playwright/test';
import { erroresAxe, expect, hayScrollHorizontal, sinProblemas, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba, type UsuarioPrueba } from './supabase';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

const NBSP = String.fromCharCode(0xa0);

async function entrar(page: Page, usuario: UsuarioPrueba) {
  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(usuario.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);
}

test('F4: alta rápida, categoría recordada por comercio, edición y borrado', async ({ page, problemas }) => {
  const usuario = await crearUsuario();
  await entrar(page, usuario);

  // CA4.1: primer gasto. Toques: «+» (1), campo comercio (2), categoría (3), Guardar (4); el importe se escribe
  let toques = 0;
  const tocar = async (accion: () => Promise<unknown>) => {
    toques += 1;
    await accion();
  };
  await tocar(() => page.getByRole('link', { name: 'Añadir gasto' }).click());
  await expect(page.getByLabel('Importe (€)')).toBeFocused();
  await page.getByLabel('Importe (€)').fill('23,45');
  await tocar(() => page.getByLabel('Comercio').click());
  await page.getByLabel('Comercio').fill('Mercadona');
  await tocar(() => page.getByLabel('Categoría').selectOption({ label: 'Supermercado' }));
  await tocar(() => page.getByRole('button', { name: 'Guardar' }).click());
  expect(toques).toBeLessThanOrEqual(4);

  await expect(page).toHaveURL(/#\/movimientos$/);
  const lista = page.locator('.lista-movimientos');
  await expect(lista.getByRole('link', { name: /Mercadona/ })).toContainText(`−23,45${NBSP}€`);
  await expect(page.locator('.totales')).toContainText(`−23,45${NBSP}€`);

  // CA4.3: con un comercio conocido (escrito de otra forma) la categoría se propone sola
  await page.getByRole('link', { name: 'Añadir gasto' }).click();
  await page.getByLabel('Importe (€)').fill('1.234,56');
  await page.getByLabel('Comercio').fill('MERCADONA, S.A.');
  await expect(page.getByLabel('Categoría')).toHaveValue(/.+/);
  await expect(page.getByLabel('Categoría').locator('option:checked')).toHaveText('Supermercado');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(lista.getByRole('link')).toHaveCount(2);
  await expect(page.locator('.totales')).toContainText(`−1.258,01${NBSP}€`);

  // Un ingreso fijo
  await page.getByRole('link', { name: 'Añadir gasto' }).click();
  await page.locator('.segmentado label', { hasText: 'Ingreso' }).click();
  await expect(page.getByRole('radio', { name: 'Ingreso' })).toBeChecked();
  await page.getByLabel('Importe (€)').fill('2500');
  await page.getByLabel('Concepto').fill('Nómina');
  await page.getByLabel('Categoría').selectOption({ label: 'Nómina' });
  await page.getByLabel('Ingreso fijo').check();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.totales')).toContainText(`+2.500,00${NBSP}€`);

  // Filtro: solo fijos
  await page.getByLabel('Tipo').selectOption({ label: 'Solo fijos' });
  await expect(lista.getByRole('link')).toHaveCount(1);
  await page.getByLabel('Tipo').selectOption({ label: 'Fijos y variables' });

  expect(await hayScrollHorizontal(page)).toBe(false);
  for (const tema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: tema });
    expect(await erroresAxe(page)).toEqual([]);
  }

  // Editar el primero
  await lista.getByRole('link', { name: /Mercadona.*23,45/ }).click();
  await expect(page.getByRole('heading', { name: 'Editar movimiento' })).toBeVisible();
  await expect(page.getByLabel('Importe (€)')).toHaveValue('23,45');
  await page.getByLabel('Importe (€)').fill('25');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(lista.getByRole('link', { name: /Mercadona/ }).first()).toContainText(/25,00/);

  // Validación: importe ambiguo
  await page.getByRole('link', { name: 'Añadir gasto' }).click();
  await page.getByLabel('Importe (€)').fill('1,234');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('alert')).toContainText('ambiguo');
  await page.goto('/#/movimientos');

  // Borrar (con confirmación dentro de la página, sin diálogos del navegador)
  await lista.getByRole('link', { name: /Nómina/ }).click();
  await page.getByRole('button', { name: 'Borrar movimiento' }).click();
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page).toHaveURL(/#\/movimientos$/);
  await expect(lista.getByRole('link')).toHaveCount(2);

  await sinProblemas(page, problemas);
});
