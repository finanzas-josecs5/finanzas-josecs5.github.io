import { expect, sinProblemas, test } from './ayudas';

// T4: prueba de concepto. El OCR debe funcionar con la CSP real y Trusted Types,
// con todo servido desde /ocr/ (SPEC §4.5, CA5.6).
test('lee un ticket sintético con la CSP de producción', async ({ page, problemas }, info) => {
  test.skip(info.project.name === 'tablet-768', 'El motor es el mismo en todas las anchuras');
  test.setTimeout(120_000);

  const peticiones: string[] = [];
  page.on('request', (r) => peticiones.push(new URL(r.url()).pathname + ` [${new URL(r.url()).host}]`));

  await page.goto('/#/lab/ocr');
  await page.getByLabel('Imagen del ticket').setInputFiles('tests/fixtures/ticket-sintetico-1.png');
  await expect(page.getByTestId('estado')).toContainText('Listo', { timeout: 100_000 });

  const texto = await page.getByTestId('texto').textContent();
  expect(texto).toMatch(/TOTAL\s+12,10/);
  expect(texto).toMatch(/05\/09\/26/);

  // Todo sale del propio sitio: ninguna petición a otro host (sin CDN) y la imagen no se sube
  const host = new URL(page.url()).host;
  expect(peticiones.filter((p) => !p.endsWith(`[${host}]`))).toEqual([]);
  expect(peticiones.some((p) => p.startsWith('/ocr/lang/spa.traineddata.gz'))).toBe(true);
  expect(peticiones.filter((p) => p.includes('.png'))).toEqual([]);

  info.annotations.push({ type: 'tiempo', description: (await page.getByTestId('estado').textContent()) ?? '' });
  await sinProblemas(page, problemas);
});
