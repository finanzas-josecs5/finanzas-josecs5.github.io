import { erroresAxe, expect, hayScrollHorizontal, sinProblemas, test, violacionesCsp } from './ayudas';

test('carga sin violaciones de CSP ni errores de consola', async ({ page, problemas }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await sinProblemas(page, problemas);
});

test('Trusted Types impide inyectar scripts', async ({ page }) => {
  await page.goto('/');
  const error = await page.evaluate(() => {
    try {
      const s = document.createElement('script');
      s.src = 'data:text/javascript,void 0';
      return null;
    } catch (e) {
      return String(e);
    }
  });
  expect(error).toMatch(/TrustedScriptURL/);
  await expect.poll(() => violacionesCsp(page)).toContainEqual(expect.stringMatching(/require-trusted-types-for/));
});

test('la CSP bloquea recursos externos (el detector funciona)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const img = document.createElement('img');
    img.src = 'https://example.com/rastreo.png';
    document.body.append(img);
  });
  await expect.poll(() => violacionesCsp(page)).toContainEqual(expect.stringMatching(/^img-src/));
});

for (const tema of ['light', 'dark'] as const) {
  test(`accesible (WCAG 2.1 AA) y sin scroll horizontal, tema ${tema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await erroresAxe(page)).toEqual([]);
    expect(await hayScrollHorizontal(page)).toBe(false);
  });
}

test('antiframe: dentro de un iframe la app no se muestra', async ({ page, baseURL }) => {
  await page.setContent(`<iframe src="${baseURL}/" width="400" height="400"></iframe>`);
  const marco = page.frameLocator('iframe');
  await expect(marco.locator('html')).toBeAttached();
  await expect(marco.locator('html')).toHaveCSS('display', 'none');
});

test('fuera de un iframe la app sí se muestra', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveCSS('display', 'none');
});
