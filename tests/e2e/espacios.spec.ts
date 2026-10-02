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

test('F2/T13: crear «Pareja», añadir al otro por email y compartir gastos', async ({ page, problemas }) => {
  const a = await crearUsuario();
  const b = await crearUsuario();
  await entrar(page, a);

  // Ajustes → Espacios: se propone «Pareja» como nombre
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('link', { name: /Espacios/ }).click();
  await expect(page).toHaveURL(/#\/ajustes\/espacios$/);
  await expect(page.getByLabel('Nombre del espacio')).toHaveValue('Pareja');
  await page.getByRole('button', { name: 'Crear espacio' }).click();

  const pareja = page.getByRole('region', { name: 'Pareja' });
  await expect(pareja.getByRole('list', { name: 'Miembros' })).toHaveText('Tú');
  await expect(page.getByLabel('Nombre del espacio')).toHaveValue('Piso');

  // Un email sin cuenta da un error claro y no añade a nadie
  await pareja.getByLabel('Email de la otra persona').fill('nadie@prueba.local');
  await pareja.getByRole('button', { name: 'Añadir' }).click();
  await expect(pareja.getByRole('alert')).toContainText('No hay ninguna cuenta con ese email');

  // Con el email de B (en mayúsculas) sí; el espacio queda completo
  await pareja.getByLabel('Email de la otra persona').fill(b.email.toUpperCase());
  await pareja.getByRole('button', { name: 'Añadir' }).click();
  await expect(pareja.getByRole('status')).toContainText(`ya puede ver «Pareja»`);
  await expect(pareja.getByRole('list', { name: 'Miembros' }).getByRole('listitem')).toHaveText(['Tú', b.email]);
  await expect(pareja.getByLabel('Email de la otra persona')).toHaveCount(0);

  // Selector completo: «Yo» primero y después los compartidos
  const selector = page.getByLabel('Espacio', { exact: true });
  await expect(selector.locator('option')).toHaveText(['Yo', 'Pareja']);

  expect(await hayScrollHorizontal(page)).toBe(false);
  for (const tema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: tema });
    expect(await erroresAxe(page)).toEqual([]);
  }

  // Alta dentro del espacio seleccionado
  await selector.selectOption({ label: 'Pareja' });
  await page.getByRole('link', { name: 'Añadir gasto' }).click();
  await expect(page.getByText('Espacio: Pareja')).toBeVisible();
  await page.getByLabel('Importe (€)').fill('30');
  await page.getByLabel('Comercio').fill('Cena Sushi');
  await page.getByLabel('Categoría').selectOption({ label: 'Restaurantes y ocio' });
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/#\/movimientos$/);
  const lista = page.locator('.lista-movimientos');
  await expect(lista.getByRole('link', { name: /Cena Sushi/ })).toContainText(`−30,00${NBSP}€`);

  // B entra y ve el gasto en «Pareja», pero no en su «Yo»
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/#\/entrar$/);
  await entrar(page, b);
  await expect(selector.locator('option')).toHaveText(['Yo', 'Pareja']);
  await selector.selectOption({ label: 'Pareja' });
  await page.getByRole('link', { name: 'Movimientos' }).click();
  await expect(lista.getByRole('link', { name: /Cena Sushi/ })).toBeVisible();
  await selector.selectOption({ label: 'Yo' });
  await expect(lista.getByRole('link', { name: /Cena Sushi/ })).toHaveCount(0);

  // En Ajustes → Espacios, B ve a A como el otro miembro
  await page.goto('/#/ajustes/espacios');
  await expect(
    page.getByRole('region', { name: 'Pareja' }).getByRole('list', { name: 'Miembros' }).getByRole('listitem'),
  ).toHaveText([a.email, 'Tú']);

  // El email sin cuenta provoca un 404 esperado (PostgREST traduce P0002); cualquier otro problema falla
  await sinProblemas(
    page,
    problemas.filter((p) => !/status of 404/.test(p)),
  );
});
