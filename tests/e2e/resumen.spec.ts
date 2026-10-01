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

test('F3/F7: nómina de 14 pagas, recurrentes y resumen en caja real y prorrateado', async ({ page, problemas }) => {
  const usuario = await crearUsuario();
  await entrar(page, usuario);

  // Resumen vacío con invitación a configurar la nómina
  await expect(page.getByTestId('disponible')).toHaveText(`0,00${NBSP}€`);
  await page.getByRole('link', { name: 'Configura tu nómina' }).click();

  // CA3.1: 14 pagas de 2.000 € → 2.333,33 € prorrateado
  await page.locator('.segmentado label', { hasText: '14 pagas' }).click();
  await page.getByLabel('Neto mensual ordinario (€)').fill('2.000');
  await page.getByRole('button', { name: 'Guardar nómina' }).click();
  await expect(page.getByRole('status')).toHaveText('Nómina guardada.');
  await expect(page.locator('.datos')).toContainText(`2.333,33${NBSP}€`);
  await expect(page.locator('.datos')).toContainText(`28.000,00${NBSP}€`);
  expect(await erroresAxe(page)).toEqual([]);

  // Recurrentes de nómina (día 1, para que la ocurrencia de este mes ya exista)
  await page.getByLabel('Día de cobro').fill('1');
  await page.getByRole('button', { name: 'Crear recurrentes de nómina' }).click();
  await expect(page.getByRole('status')).toContainText('Recurrentes creados');
  await page.getByRole('button', { name: 'Crear recurrentes de nómina' }).click();
  await expect(page.getByRole('alert')).toContainText('Ya tienes recurrentes de nómina');

  // El resumen avisa del pendiente; se confirma en Movimientos
  await page.goto('/#/resumen');
  await expect(page.getByText(/recurrente pendiente/)).toBeVisible();
  await page.goto('/#/movimientos');
  await page.getByRole('button', { name: 'Confirmar Nómina' }).click();

  // Un gasto fijo
  await page.getByRole('link', { name: 'Añadir gasto' }).click();
  await page.getByLabel('Importe (€)').fill('800');
  await page.getByLabel('Comercio').fill('Alquiler');
  await page.getByLabel('Categoría').selectOption({ label: 'Vivienda' });
  await page.getByLabel('Gasto fijo').check();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/#\/movimientos$/);

  // CA7.1: caja real
  await page.goto('/#/resumen');
  await expect(page.getByTestId('entradas')).toHaveText(`+2.000,00${NBSP}€`);
  await expect(page.getByTestId('disponible')).toHaveText(`+1.200,00${NBSP}€`);
  await expect(page.getByRole('region', { name: 'Salidas por categoría' })).toContainText('Vivienda');

  // CA3.2: prorrateada (la nómina apuntada se sustituye por 2.333,33)
  await page.locator('.segmentado label', { hasText: 'Prorrateada' }).click();
  await expect(page.getByTestId('entradas')).toHaveText(`+2.333,33${NBSP}€`);
  await expect(page.getByTestId('disponible')).toHaveText(`+1.533,33${NBSP}€`);
  await expect(page.getByTestId('nota-prorrateo')).toBeVisible();

  expect(await hayScrollHorizontal(page)).toBe(false);
  for (const tema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: tema });
    expect(await erroresAxe(page)).toEqual([]);
  }
  await sinProblemas(page, problemas);
});
