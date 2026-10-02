import { erroresAxe, expect, hayScrollHorizontal, sinProblemas, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba } from './supabase';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

const NBSP = String.fromCharCode(0xa0);

test('F9: simulador con escenarios, impuestos, inflación del INE y tabla (CA9.1, CA9.2)', async ({ page, problemas }) => {
  const usuario = await crearUsuario();
  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(usuario.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);

  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Simulador' }).click();
  await expect(page.getByRole('heading', { name: 'Simulador' })).toBeVisible();

  // CA9.2: la inflación muestra su fuente y su fecha
  await expect(page.getByTestId('fuente-inflacion')).toContainText('INE, serie IPC290750');
  await expect(page.getByText(/Último dato INE: \d/)).toBeVisible();

  // Caso de la spec: 10.000 € al 7 %, sin aportaciones ni TER, 10 años → neto 17.760,49 €
  await page.getByLabel('Aportación inicial (€)').fill('10000');
  await page.getByLabel('Aportación mensual (€)').fill('0');
  await page.getByLabel('Plazo (años)').fill('10');
  await page.getByLabel('Fondo · optimista (% anual)').fill('7');
  await page.getByLabel('TER del fondo (%)').fill('0');
  const tabla = page.getByTestId('tabla-resultado');
  await expect(tabla.getByRole('row', { name: /Fondo · optimista/ })).toContainText(`17.760,49${NBSP}€`);
  await expect(tabla.getByRole('row', { name: /Fondo · optimista/ })).toContainText(`1.911,02${NBSP}€`);

  // CA9.1: gráfico con un punto por año (0–10) y la cuenta; tabla año a año
  const grafico = page.getByRole('group', { name: 'Simulador' });
  await expect(grafico.getByRole('button')).toHaveCount(11);
  await grafico.getByRole('button').first().focus();
  await expect(page.getByTestId('lectura-simulador')).toContainText('Año 0');
  await expect(page.getByRole('region', { name: 'Tabla año a año' }).locator('tbody tr')).toHaveCount(11);

  // Validación y opción de inflación manual
  await page.getByLabel('Plazo (años)').fill('0');
  await expect(page.getByRole('alert')).toContainText('El plazo debe ser');
  await page.getByLabel('Plazo (años)').fill('10');
  await page.getByLabel('Manual').check();
  await page.getByLabel('Inflación manual (%)').fill('2');
  await expect(page.getByRole('alert')).toHaveCount(0);

  expect(await hayScrollHorizontal(page)).toBe(false);
  for (const tema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: tema });
    expect(await erroresAxe(page)).toEqual([]);
  }

  // Los parámetros se recuerdan
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByLabel('Aportación inicial (€)')).toHaveValue('10000');
  await sinProblemas(page, problemas);
});
