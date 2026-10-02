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

const selector = (page: Page) => page.getByRole('combobox', { name: /^Espacio/ });

test('T14: pagado por, reparto propio del gasto y auditoría (CA6.6, CA6.7, CA6.8)', async ({ page, problemas }) => {
  const a = await crearUsuario();
  const b = await crearUsuario();

  // A crea «Pareja» y añade a B
  await entrar(page, a);
  await page.goto('/#/ajustes/espacios');
  await page.getByRole('button', { name: 'Crear espacio' }).click();
  const pareja = page.getByRole('region', { name: 'Pareja' });
  await pareja.getByLabel('Email de la otra persona').fill(b.email);
  await pareja.getByRole('button', { name: 'Añadir' }).click();
  await expect(pareja.getByRole('list', { name: 'Miembros' }).getByRole('listitem')).toHaveCount(2);

  // Gasto de 100 € pagado por A, con un 70/30 solo para este gasto
  await selector(page).selectOption({ label: 'Pareja' });
  await page.getByRole('link', { name: 'Añadir gasto' }).click();
  await page.getByLabel('Importe (€)').fill('100');
  await page.getByLabel('Comercio').fill('Muebles');
  await page.getByLabel('Categoría').selectOption({ label: 'Vivienda' });
  const reparto = page.getByRole('group', { name: 'Gasto compartido' });
  await expect(reparto.getByLabel('Pagado por')).toHaveValue(a.id);
  await expect(reparto.getByLabel('Tu parte (%)')).toHaveValue('50');
  await reparto.getByLabel('Tu parte (%)').fill('120');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('alert')).toContainText('entre 0 y 100');
  await reparto.getByLabel('Tu parte (%)').fill('70');
  await expect(page.getByTestId('vista-reparto')).toHaveText(`Tú pones 70,00${NBSP}€ · ${b.email} pone 30,00${NBSP}€`);
  expect(await hayScrollHorizontal(page)).toBe(false);
  expect(await erroresAxe(page)).toEqual([]);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/#\/movimientos$/);

  // B lo ve con SU parte (30 %), creado por A
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await entrar(page, b);
  await selector(page).selectOption({ label: 'Pareja' });
  await page.getByRole('link', { name: 'Movimientos' }).click();
  await page.locator('.lista-movimientos').getByRole('link', { name: /Muebles/ }).click();
  await expect(page.locator('.auditoria div').nth(0)).toContainText('Creado por');
  await expect(page.locator('.auditoria div').nth(0)).toContainText(a.email);
  await expect(page.getByRole('group', { name: 'Gasto compartido' }).getByLabel('Pagado por')).toHaveValue(a.id);
  await expect(page.getByRole('group', { name: 'Gasto compartido' }).getByLabel('Tu parte (%)')).toHaveValue('30');

  // CA6.6: B lo edita; queda «Modificado por: Tú» y el reparto se conserva
  await page.getByLabel('Importe (€)').fill('120');
  await expect(page.getByTestId('vista-reparto')).toHaveText(`Tú pones 36,00${NBSP}€ · ${a.email} pone 84,00${NBSP}€`);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page).toHaveURL(/#\/movimientos$/);
  await page.locator('.lista-movimientos').getByRole('link', { name: /Muebles/ }).click();
  await expect(page.locator('.auditoria')).toContainText('Modificado por');
  await expect(page.locator('.auditoria div').nth(1)).toContainText('Tú');
  await expect(page.locator('.auditoria div').nth(0)).toContainText(a.email);

  await sinProblemas(page, problemas);
});
