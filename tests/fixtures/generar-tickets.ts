// Genera tickets SINTÉTICOS (datos inventados) para los tests de OCR. Nunca usar tickets reales.
// Uso: node tests/fixtures/generar-tickets.ts
import { chromium } from '@playwright/test';

const tickets: Record<string, string[]> = {
  'ticket-sintetico-1': [
    'SUPERMERCADO EJEMPLO S.A.',
    'C/ Inventada 123, Madrid',
    'NIF A00000000',
    '05/09/26 18:42',
    '',
    'PAN DE MOLDE           1,85',
    'LECHE ENTERA 6U        5,40',
    'MANZANAS 1KG           2,75',
    '',
    'SUBTOTAL              10,00',
    'IVA 21%                2,10',
    'TOTAL                 12,10',
    '',
    'TARJETA               12,10',
  ],
  'ticket-sintetico-2': [
    'FARMACIA DEMO',
    'Avda. Ficticia 9, Valencia',
    'Fecha: 12-08-2026',
    '',
    'IBUPROFENO 600         3,20',
    'CREMA SOLAR           20,25',
    '',
    'TOTAL EUR             23,45',
  ],
  'ticket-sintetico-3': [
    'RESTAURANTE PRUEBA',
    'Plaza Imaginaria 1, Sevilla',
    '21/09/2026  22:10',
    '',
    '2 MENU DEL DIA        30,00',
    '1 VINO TINTO          12,50',
    '2 CAFE                 2,80',
    'BASE IMPONIBLE        41,27',
    'IVA 10%                4,13',
    'TOTAL A PAGAR         48,90',
    'CAMBIO                 1,10',
  ],
};

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 420, height: 200 }, deviceScaleFactor: 2 });
for (const [nombre, lineas] of Object.entries(tickets)) {
  const html = lineas.map((l) => `<div>${l.replaceAll(' ', '&nbsp;') || '&nbsp;'}</div>`).join('');
  await pagina.setContent(
    `<body style="margin:0;background:#fff"><div id="t" style="font:18px/1.35 'Courier New',monospace;color:#111;padding:24px;width:360px">${html}</div></body>`,
  );
  await pagina.locator('#t').screenshot({ path: `tests/fixtures/${nombre}.png` });
}

// Captura SINTÉTICA de una app de bróker (CA8.4): letra sin serifa, como en un móvil
const captura = [
  'Fondo Indexado Ejemplo',
  'ES0000000000',
  '',
  'Valor de la posición',
  '12.345,67 €',
  '',
  'Importe invertido 10.000,00 €',
  'Rentabilidad +2.345,67 €',
  'Valor liquidativo 45,21 €',
];
await pagina.setContent(
  `<body style="margin:0;background:#fff"><div id="t" style="font:20px/1.5 Arial,sans-serif;color:#111;padding:24px;width:380px">${captura
    .map((l) => `<div>${l || '&nbsp;'}</div>`)
    .join('')}</div></body>`,
);
await pagina.locator('#t').screenshot({ path: 'tests/fixtures/captura-broker-sintetica.png' });

await navegador.close();
console.log(`generar-tickets: ${Object.keys(tickets).length} tickets y 1 captura`);
