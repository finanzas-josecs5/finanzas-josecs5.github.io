import { erroresAxe, expect, sinProblemas, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba } from './supabase';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

const NBSP = String.fromCharCode(0xa0);

function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('T19: recordatorios de fondos y liquidez, y valor leído de una captura (CA8.3–CA8.5)', async ({ page, problemas }, info) => {
  test.setTimeout(150_000);
  const usuario = await crearUsuario();
  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(usuario.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);

  // Un fondo valorado hace 40 días
  await page.goto('/#/fondos/nuevo');
  await page.getByLabel('Nombre').fill('MSCI World');
  await page.getByLabel('ISIN').fill('IE00B4L5Y983');
  await page.getByRole('button', { name: 'Guardar fondo' }).click();
  await page.getByRole('link', { name: 'Actualizar valor' }).click();
  await page.getByLabel('Valor actual (€)').fill('1.000');
  await page.getByLabel('Fecha del valor').fill(haceDias(40));
  await page.getByRole('button', { name: 'Guardar valor' }).click();
  await expect(page.getByRole('heading', { name: 'MSCI World' })).toBeVisible();

  // CA8.3 y CA8.5: el Resumen recuerda el fondo y la liquidez
  await page.goto('/#/resumen');
  const avisos = page.getByRole('region', { name: 'Recordatorios' });
  await expect(avisos).toContainText('Actualiza el valor de MSCI World (hace 40 días)');
  await expect(avisos).toContainText('Apunta tu liquidez');
  expect(await erroresAxe(page)).toEqual([]);

  // Liquidez de hoy: desaparece ese aviso
  await avisos.getByRole('link', { name: /liquidez/ }).click();
  await page.getByLabel('Saldo total (€)').fill('15.000');
  await page.getByRole('button', { name: 'Guardar liquidez' }).click();
  await expect(page.getByRole('status')).toHaveText('Liquidez guardada.');
  await expect(page.getByRole('region', { name: 'Apuntes' })).toContainText(`15.000,00${NBSP}€`);
  await page.goto('/#/resumen');
  await expect(avisos).toContainText('MSCI World');
  await expect(avisos).not.toContainText('liquidez');

  // CA8.4: valor leído de una captura (OCR real), con confirmación antes de guardar
  // El OCR (WebAssembly) satura la CPU del runner: la captura solo se prueba en una anchura
  if (info.project.name !== 'escritorio-1280') {
    await sinProblemas(page, problemas);
    return;
  }
  await avisos.getByRole('link', { name: /MSCI World/ }).click();
  await page.getByLabel('Leer de captura').setInputFiles('tests/fixtures/captura-broker-sintetica.png');
  await expect(page.getByTestId('lectura-captura')).toContainText(`12.345,67${NBSP}€`, { timeout: 120_000 });
  await expect(page.getByLabel('Valor actual (€)')).toHaveValue('12345,67');
  await page.getByRole('button', { name: 'Guardar valor' }).click();
  await expect(page.locator('.datos')).toContainText(`12.345,67${NBSP}€`);

  await page.goto('/#/resumen');
  await expect(page.getByRole('region', { name: 'Recordatorios' })).toHaveCount(0);
  await sinProblemas(page, problemas);
});
