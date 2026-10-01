import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { erroresAxe, expect, sinProblemas, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba, type UsuarioPrueba } from './supabase';
import { codigoTotp } from './totp';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

async function entrar(page: Page, usuario: UsuarioPrueba) {
  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(usuario.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('CA1.2: el registro público está desactivado', async () => {
  const cliente = createClient(process.env.VITE_SUPABASE_URL ?? '', process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '', {
    auth: { persistSession: false },
  });
  const { data, error } = await cliente.auth.signUp({ email: `intruso-${Date.now()}@prueba.local`, password: 'Intruso-2026!xx' });
  expect(error?.message).toMatch(/signups not allowed/i);
  expect(data.user).toBeNull();
});

test('CA1.4: activar TOTP, entrar con código y desactivarlo', async ({ page, problemas }) => {
  test.setTimeout(90_000);
  const usuario = await crearUsuario();
  await entrar(page, usuario);
  await expect(page).toHaveURL(/#\/resumen$/);

  // Activar desde Ajustes → Seguridad
  await page.goto('/#/ajustes');
  await page.getByRole('link', { name: /Seguridad/ }).click();
  await page.getByRole('button', { name: 'Activar' }).click();
  await expect(page.getByRole('img', { name: 'Código QR para la app de autenticación' })).toBeVisible();
  expect(await erroresAxe(page)).toEqual([]);
  const secreto = (await page.getByTestId('secreto-totp').textContent()) ?? '';
  await page.getByLabel('Código de 6 cifras').fill(codigoTotp(secreto));
  await page.getByRole('button', { name: 'Confirmar y activar' }).click();
  await expect(page.getByRole('status')).toContainText('activada');

  // Nuevo acceso: tras la contraseña pide el código y sin él no deja pasar
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/#\/entrar$/);
  await entrar(page, usuario);
  await expect(page).toHaveURL(/#\/entrar\/mfa$/);
  await page.goto('/#/fondos');
  await expect(page).toHaveURL(/#\/entrar\/mfa$/);

  await page.getByLabel('Código').fill('000000');
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('alert')).toContainText('Código incorrecto');

  await page.getByLabel('Código').fill(codigoTotp(secreto));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);

  // Desactivar
  await page.goto('/#/ajustes/seguridad');
  await page.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByRole('status')).toHaveText('Verificación en dos pasos desactivada.');
  await expect(page.getByRole('button', { name: 'Activar' })).toBeVisible();
  await sinProblemasSalvoCodigoErroneo(page, problemas);
});

// El código erróneo provoca un 4xx esperado en la consola; cualquier otro problema falla
async function sinProblemasSalvoCodigoErroneo(page: Page, problemas: string[]) {
  const resto = problemas.filter((p) => !/status of 4\d\d/.test(p));
  await sinProblemas(page, resto);
}
