import { erroresAxe, expect, hayScrollHorizontal, sinProblemas, test } from './ayudas';
import { crearUsuario, hayBackendDePrueba } from './supabase';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

const NBSP = String.fromCharCode(0xa0);

// T17: gastos desde foto con el motor OCR real, la CSP de producción y Trusted Types (SPEC §4.5)
test('CA5.5/CA5.6: tres tickets → tarjetas para revisar; nada sale del navegador', async ({ page, problemas }, info) => {
  // El OCR (WebAssembly) satura la CPU del runner: solo en una anchura, que el motor es el mismo
  test.skip(info.project.name !== 'escritorio-1280', 'El motor es el mismo en todas las anchuras');
  test.setTimeout(180_000);
  const usuario = await crearUsuario();

  // Registro de todas las peticiones: solo al propio sitio y a la API de Supabase
  const peticiones: { url: URL; metodo: string; tipo: string }[] = [];
  page.on('request', (r) => peticiones.push({ url: new URL(r.url()), metodo: r.method(), tipo: r.headers()['content-type'] ?? '' }));

  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(usuario.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);

  await page.getByRole('link', { name: 'Añadir gasto' }).click();
  await page.getByRole('link', { name: '¿Tienes el ticket? Léelo de una foto' }).click();
  await expect(page).toHaveURL(/#\/movimientos\/foto$/);

  await page
    .getByLabel('Elegir fotos de tickets')
    .setInputFiles(['tests/fixtures/ticket-sintetico-1.png', 'tests/fixtures/ticket-sintetico-2.png', 'tests/fixtures/ticket-sintetico-3.png']);

  const tarjeta = (n: number) => page.getByRole('article', { name: `Ticket ticket-sintetico-${n}.png` });
  await expect(tarjeta(1).getByLabel('Importe (€)')).toHaveValue('12,10', { timeout: 150_000 });
  await expect(tarjeta(2).getByLabel('Importe (€)')).toHaveValue('23,45', { timeout: 150_000 });
  await expect(tarjeta(3).getByLabel('Importe (€)')).toHaveValue('48,90', { timeout: 150_000 });
  await expect(tarjeta(1).getByLabel('Comercio')).toHaveValue(/SUPERMERCADO/);
  await expect(tarjeta(3).getByLabel('Fecha')).toHaveValue('2026-09-21');

  // Nada se guarda sin confirmar: todavía no hay movimientos
  expect(peticiones.filter((p) => p.metodo === 'POST' && p.url.pathname.includes('/rest/v1/movimientos'))).toEqual([]);

  expect(await hayScrollHorizontal(page)).toBe(false);
  for (const tema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: tema });
    expect(await erroresAxe(page)).toEqual([]);
  }

  // Revisar: fecha de hoy (para verlos en el mes actual) y categoría; descartar el segundo
  const hoy = new Date();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  for (const [n, categoria] of [
    [1, 'Supermercado'],
    [3, 'Restaurantes y ocio'],
  ] as const) {
    await tarjeta(n).getByLabel('Fecha').fill(fechaHoy);
    await tarjeta(n).getByLabel('Categoría').selectOption({ label: categoria });
  }
  await tarjeta(2).getByRole('button', { name: 'Descartar' }).click();
  await expect(tarjeta(2)).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar todos (2)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'gastos guardados' })).toHaveText(/2 gastos guardados/);

  await page.getByRole('link', { name: 'Ver movimientos' }).click();
  const lista = page.locator('.lista-movimientos');
  await expect(lista.getByRole('link')).toHaveCount(2);
  await expect(lista).toContainText(`12,10${NBSP}€`);
  await expect(lista).toContainText(`48,90${NBSP}€`);

  // CA5.6: el motor se sirvió desde /ocr/ y ninguna petición llevó una imagen ni salió a otro host
  const sitio = new URL(page.url()).host;
  const supabase = new URL(process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321').host;
  expect(peticiones.filter((p) => p.url.protocol !== 'blob:' && p.url.protocol !== 'data:' && ![sitio, supabase].includes(p.url.host))).toEqual([]);
  expect(peticiones.some((p) => p.url.pathname === '/ocr/lang/spa.traineddata.gz')).toBe(true);
  expect(peticiones.filter((p) => p.tipo.startsWith('image/') || p.tipo.startsWith('multipart/'))).toEqual([]);
  expect(peticiones.filter((p) => p.url.pathname.startsWith('/storage/'))).toEqual([]);

  await sinProblemas(page, problemas);
});
