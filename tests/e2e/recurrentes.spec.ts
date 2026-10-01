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

/** Primer día del mes actual en formato del campo date (las ocurrencias caen en este mes). */
function primeroDeMes(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
}

async function crearRecurrente(page: Page, nombre: string, importe: string, categoria: string) {
  await page.goto('/#/recurrentes/nuevo');
  await page.getByLabel('Importe (€)').fill(importe);
  await page.getByLabel('Comercio').fill(nombre);
  await page.getByLabel('Categoría').selectOption({ label: categoria });
  await page.getByLabel('Primera vez').fill(primeroDeMes());
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/#\/recurrentes$/);
}

test('CA4.4: recurrentes que se confirman o ajustan una a una', async ({ page, problemas }) => {
  const usuario = await crearUsuario();
  await entrar(page, usuario);

  await crearRecurrente(page, 'Netflix', '12,99', 'Suscripciones');
  await crearRecurrente(page, 'Alquiler', '800', 'Vivienda');
  const lista = page.locator('.lista-movimientos');
  await expect(lista.getByRole('link')).toHaveCount(2);
  await expect(lista.getByRole('link', { name: /Netflix/ })).toContainText('Cada mes');
  expect(await erroresAxe(page)).toEqual([]);

  // En Movimientos aparecen como pendientes del mes
  await page.goto('/#/movimientos');
  const pendientes = page.getByRole('region', { name: 'Pendientes de confirmar' });
  await expect(pendientes.getByRole('listitem')).toHaveCount(2);
  expect(await hayScrollHorizontal(page)).toBe(false);

  // Confirmar Netflix tal cual
  await pendientes.getByRole('button', { name: 'Confirmar Netflix' }).click();
  await expect(pendientes.getByRole('listitem')).toHaveCount(1);
  await expect(page.locator('.lista-movimientos').getByRole('link', { name: /Netflix/ })).toContainText(`12,99${NBSP}€`);

  // Ajustar el alquiler (este mes fue distinto)
  await pendientes.getByRole('link', { name: 'Ajustar Alquiler' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustar recurrente' })).toBeVisible();
  await expect(page.getByLabel('Importe (€)')).toHaveValue('800,00');
  await page.getByLabel('Importe (€)').fill('815,50');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page).toHaveURL(/#\/movimientos$/);
  await expect(page.getByRole('region', { name: 'Pendientes de confirmar' })).toHaveCount(0);
  await expect(page.locator('.lista-movimientos').getByRole('link', { name: /Alquiler/ })).toContainText(`815,50${NBSP}€`);

  // El recurrente sigue con su importe original: ajustar una ocurrencia no cambia las demás
  await page.goto('/#/recurrentes');
  await expect(page.locator('.lista-movimientos').getByRole('link', { name: /Alquiler/ })).toContainText(`800,00${NBSP}€`);

  // Borrar un recurrente conserva lo ya confirmado
  await page.locator('.lista-movimientos').getByRole('link', { name: /Netflix/ }).click();
  await page.getByRole('button', { name: 'Borrar recurrente' }).click();
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.locator('.lista-movimientos').getByRole('link')).toHaveCount(1);
  await page.goto('/#/movimientos');
  await expect(page.locator('.lista-movimientos').getByRole('link', { name: /Netflix/ })).toBeVisible();

  await sinProblemas(page, problemas);
});
