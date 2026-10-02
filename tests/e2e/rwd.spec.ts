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

// RWD3: la navegación es visible en cada anchura, se recorre con el tabulador, el foco se ve
// y Intro abre la sección
test('RWD3: navegación visible y usable con teclado, con foco visible', async ({ page }) => {
  await entrar(page, await crearUsuario());
  const navegacion = page.getByRole('navigation', { name: 'Principal' });
  await expect(navegacion).toBeVisible();

  for (let i = 0; i < 30 && !(await navegacion.evaluate((nav) => nav.contains(document.activeElement))); i++) {
    await page.keyboard.press('Tab');
  }
  // El primero es Resumen, la sección actual: se pasa al siguiente para que Intro cambie de pantalla
  await page.keyboard.press('Tab');
  const enlace = navegacion.locator('a:focus');
  await expect(enlace).toHaveCount(1);
  const contorno = await enlace.evaluate((a) => {
    const estilo = getComputedStyle(a);
    return { estilo: estilo.outlineStyle, ancho: parseFloat(estilo.outlineWidth) };
  });
  expect(contorno.estilo).not.toBe('none');
  expect(contorno.ancho).toBeGreaterThanOrEqual(2);

  const destino = await enlace.getAttribute('href');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${destino}$`));
});

// RWD8: todos los campos de importe abren el teclado numérico con decimales
test('RWD8: los campos de importe usan inputmode="decimal"', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil-375', 'Es un atributo: basta con una anchura');
  test.setTimeout(120_000);
  await entrar(page, await crearUsuario());
  let revisados = 0;
  for (const ruta of PAGINAS) {
    await abrir(page, ruta);
    const campos = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="number"], input:not([type])')]
        .filter((campo) => /€|importe/i.test([...(campo.labels ?? [])].map((l) => l.textContent ?? '').join(' ')))
        .map((campo) => ({ etiqueta: (campo.labels?.[0]?.textContent ?? '').trim(), modo: campo.inputMode })),
    );
    revisados += campos.length;
    for (const campo of campos) expect.soft(campo.modo, `${campo.etiqueta} en ${ruta}`).toBe('decimal');
  }
  expect(revisados).toBeGreaterThan(0);
});
