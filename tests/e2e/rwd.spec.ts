import { abrir, destinosPequenos, entrar, erroresAxe, expect, hayScrollHorizontal, PAGINAS, test, textoCortado } from './ayudas';
import { crearUsuario, hayBackendDePrueba } from './supabase';

test.skip(!hayBackendDePrueba, 'Requiere el Supabase local (se ejecuta en CI)');

// RWD5 (WCAG 1.4.10): a 320 px de ancho (equivale a 1280 px con zoom al 400 %) todo se reajusta
// sin scroll horizontal
test('RWD5: reflujo a 320 px en todas las pantallas principales', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil-375', 'Basta con una pasada a 320 px');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 640 });
  await entrar(page, await crearUsuario());

  for (const ruta of PAGINAS) {
    await abrir(page, ruta);
    expect(await hayScrollHorizontal(page), `scroll horizontal en ${ruta}`).toBe(false);
    expect(await erroresAxe(page), `axe en ${ruta}`).toEqual([]);
  }
});

// RWD5 (WCAG 1.4.4): con el texto al 200 % nada se corta. Equivale a subir el tamaño de letra
// del navegador: todo el tema está en rem
test('RWD5: texto al 200 % sin recortes ni scroll horizontal', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio-1280', 'Se comprueba a 1280 px');
  test.setTimeout(120_000);
  await entrar(page, await crearUsuario());
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  for (const ruta of PAGINAS) {
    await abrir(page, ruta);
    expect.soft(await hayScrollHorizontal(page), `scroll horizontal en ${ruta}`).toBe(false);
    expect.soft(await textoCortado(page), `texto cortado en ${ruta}`).toEqual([]);
  }
});

// RWD2: destinos táctiles de al menos 44×44 px a 375 y 768
test('RWD2: destinos táctiles de 44×44 px en todas las pantallas', async ({ page }, info) => {
  test.skip(info.project.name === 'escritorio-1280', 'Solo en anchuras táctiles');
  test.setTimeout(120_000);
  await page.goto('/#/entrar');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  expect.soft(await destinosPequenos(page), 'destinos pequeños en /entrar').toEqual([]);

  await entrar(page, await crearUsuario());
  for (const ruta of PAGINAS) {
    await abrir(page, ruta);
    expect.soft(await destinosPequenos(page), `destinos pequeños en ${ruta}`).toEqual([]);
  }
});
