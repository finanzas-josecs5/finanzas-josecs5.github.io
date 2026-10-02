import { readFileSync } from 'node:fs';
import { expect, sinProblemas, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba } from './supabase';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

test('CA12.1: exportar cifrado, borrar e importar devuelve el mismo estado', async ({ page, problemas }, info) => {
  test.skip(info.project.name !== 'escritorio-1280', 'El flujo es el mismo en todas las anchuras');
  const usuario = await crearUsuario();
  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(usuario.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);

  // Un gasto que luego se borrará
  await page.getByRole('link', { name: 'Añadir gasto' }).click();
  await page.getByLabel('Importe (€)').fill('23,45');
  await page.getByLabel('Comercio').fill('Mercadona');
  await page.getByLabel('Categoría').selectOption({ label: 'Supermercado' });
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.lista-movimientos').getByRole('link')).toHaveCount(1);

  // Exportar cifrado
  await page.goto('/#/ajustes/copia');
  await page.getByLabel('Contraseña de la copia', { exact: true }).fill('Copia-segura-2026');
  await page.getByLabel('Repite la contraseña').fill('Copia-segura-2026');
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar' }).click();
  const archivo = await (await descarga).path();
  const contenido = readFileSync(archivo, 'utf8');
  expect(contenido).not.toContain('Mercadona');
  expect(JSON.parse(contenido)).toMatchObject({ formato: 'finanzas-personales', cifrado: { alg: 'AES-GCM', kdf: 'PBKDF2-SHA256' } });

  // Borrar el gasto
  await page.goto('/#/movimientos');
  await page.locator('.lista-movimientos').getByRole('link', { name: /Mercadona/ }).click();
  await page.getByRole('button', { name: 'Borrar movimiento' }).click();
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  // Al terminar de borrar, la app vuelve a la lista: hay que esperarla, o esa navegación llega
  // después del goto a la copia (en el detalle no hay lista y el recuento 0 pasaría enseguida)
  await expect(page).toHaveURL(/#\/movimientos$/);
  await expect(page.getByText('Mercadona')).toHaveCount(0);

  // Importar con una contraseña errónea falla; con la buena, restaura
  await page.goto('/#/ajustes/copia');
  await page.getByLabel('Archivo de copia').setInputFiles(archivo);
  await page.getByRole('form', { name: 'Importar' }).getByLabel('Contraseña de la copia').fill('No-es-esta-1234');
  await page.getByRole('button', { name: 'Revisar copia' }).click();
  await expect(page.getByRole('form', { name: 'Importar' }).getByRole('alert')).toContainText('Contraseña incorrecta');
  await page.getByRole('form', { name: 'Importar' }).getByLabel('Contraseña de la copia').fill('Copia-segura-2026');
  await page.getByRole('button', { name: 'Revisar copia' }).click();
  await expect(page.getByRole('group', { name: 'Confirmar importación' })).toContainText('1 movimientos');
  await page.getByRole('button', { name: 'Sí, importar' }).click();
  await expect(page.getByRole('status')).toContainText('Copia importada');

  await page.goto('/#/movimientos');
  await expect(page.locator('.lista-movimientos').getByRole('link', { name: /Mercadona/ })).toContainText('23,45');
  await sinProblemas(page, problemas);
});
