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

async function gastoComun(page: Page, importe: string, comercio: string, pagadoPor?: string) {
  await page.getByRole('link', { name: 'Añadir gasto' }).click();
  await page.getByLabel('Importe (€)').fill(importe);
  await page.getByLabel('Comercio').fill(comercio);
  await page.getByLabel('Categoría').selectOption({ label: 'Restaurantes y ocio' });
  if (pagadoPor) await page.getByRole('group', { name: 'Gasto compartido' }).getByLabel('Pagado por').selectOption(pagadoPor);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/#\/movimientos$/);
}

test('T15: saldo, saldar y mi parte en el resumen de «Yo» (CA6.2, CA6.3)', async ({ page, problemas }) => {
  const a = await crearUsuario();
  const b = await crearUsuario();
  await entrar(page, a);

  // Sin espacios compartidos, la pestaña invita a crearlos
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Común' }).click();
  await expect(page.getByText('Aún no tienes espacios compartidos')).toBeVisible();

  await page.goto('/#/ajustes/espacios');
  await page.getByRole('button', { name: 'Crear espacio' }).click();
  const pareja = page.getByRole('region', { name: 'Pareja' });
  await pareja.getByLabel('Email de la otra persona').fill(b.email);
  await pareja.getByRole('button', { name: 'Añadir' }).click();
  await expect(pareja.getByRole('list', { name: 'Miembros' }).getByRole('listitem')).toHaveCount(2);

  // CA6.2: A paga 100 €, B paga 30 €, ambos al 50/50
  await selector(page).selectOption({ label: 'Pareja' });
  await gastoComun(page, '100', 'Cena');
  await gastoComun(page, '30', 'Cine', b.id);

  await page.goto('/#/comun');
  const tarjeta = page.getByRole('region', { name: 'Pareja' });
  await expect(tarjeta.getByTestId('saldo')).toHaveText(`${b.email} te debe 35,00${NBSP}€`);

  // CA6.3: en «Yo» solo cuenta mi parte (50 + 15 = 65 €)
  await selector(page).selectOption({ label: 'Yo' });
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Resumen' }).click();
  await expect(page.getByTestId('disponible')).toHaveText(`−65,00${NBSP}€`);
  await expect(page.getByRole('region', { name: 'Salidas por categoría' })).toContainText('Común · Pareja');

  // B ve lo que debe y salda. Antes de cerrar sesión se espera a que terminen las cargas del
  // Resumen (consejos y avisos): si no, salen ya sin sesión y responden 401
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await entrar(page, b);
  await page.goto('/#/comun');
  await expect(page.getByRole('region', { name: 'Pareja' }).getByTestId('saldo')).toHaveText(`Debes 35,00${NBSP}€ a ${a.email}`);
  await page.getByRole('region', { name: 'Pareja' }).getByRole('link', { name: 'Saldar' }).click();
  await expect(page.getByTestId('sentido-pago')).toContainText(`Le pagas a ${a.email}`);
  await expect(page.getByLabel('Importe (€)')).toHaveValue('35,00');

  await page.getByLabel('Importe (€)').fill('40');
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(page.getByRole('alert')).toContainText('No puede ser mayor que lo pendiente');
  expect(await hayScrollHorizontal(page)).toBe(false);
  expect(await erroresAxe(page)).toEqual([]);

  await page.getByLabel('Importe (€)').fill('35');
  await page.getByLabel('Nota (opcional)').fill('Bizum');
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(page).toHaveURL(/#\/comun$/);
  await expect(page.getByRole('region', { name: 'Pareja' }).getByTestId('saldo')).toHaveText('Estáis en paz');
  await expect(page.getByRole('region', { name: 'Pareja' })).toContainText(`Pagaste 35,00${NBSP}€ · Bizum`);
  await expect(page.getByRole('region', { name: 'Pareja' }).getByRole('link', { name: 'Saldar' })).toHaveCount(0);

  for (const tema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: tema });
    expect(await erroresAxe(page)).toEqual([]);
  }
  await sinProblemas(page, problemas);
});
