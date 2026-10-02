import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __violacionesCsp: string[];
  }
}

/**
 * Test base: registra cualquier violación de CSP o error de consola y hace
 * fallar el test al terminar (SPEC S12 y S15: sustituye a report-to).
 */
export const test = base.extend<{ problemas: string[] }>({
  problemas: [
    async ({ page }, usar) => {
      const problemas: string[] = [];
      await page.addInitScript(() => {
        window.__violacionesCsp = [];
        document.addEventListener('securitypolicyviolation', (e) => {
          window.__violacionesCsp.push(`${e.violatedDirective}: ${e.blockedURI || 'inline'}`);
        });
      });
      page.on('console', (m) => {
        // Con la URL del recurso: «Failed to load resource» no dice qué petición falló
        if (m.type() === 'error') problemas.push(`consola: ${m.text()} [${m.location().url.replace(/\?.*$/, '')}]`);
      });
      page.on('pageerror', (e) => problemas.push(`excepción: ${e.message}`));
      await usar(problemas);
    },
    { auto: true },
  ],
});

export { expect };

export async function violacionesCsp(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__violacionesCsp ?? []);
}

export async function sinProblemas(page: Page, problemas: string[]): Promise<void> {
  expect([...problemas, ...(await violacionesCsp(page))]).toEqual([]);
}

export async function erroresAxe(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}

/** RWD1: sin scroll horizontal */
export async function hayScrollHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

/** Pantallas principales con sesión iniciada (RWD2, RWD5 y RWD6) */
export const PAGINAS = [
  '/resumen',
  '/resumen/historico',
  '/movimientos',
  '/movimientos/nuevo',
  '/comun',
  '/fondos',
  '/simulador',
  '/consejos',
  '/ajustes',
];

export async function entrar(page: Page, usuario: { email: string; contrasena: string }): Promise<void> {
  await page.goto('/#/entrar');
  await page.getByLabel('Email').fill(usuario.email);
  await page.getByLabel('Contraseña').fill(usuario.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/resumen$/);
}

/** Navega a una pantalla y espera a que termine de cargar */
export async function abrir(page: Page, ruta: string): Promise<void> {
  await page.goto(`/#${ruta}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.cargando')).toHaveCount(0);
}

/**
 * RWD2: destinos táctiles visibles de menos de 44×44 px. Las casillas y opciones se miden por
 * su etiqueta, que es lo que se toca. Excepciones de WCAG 2.5.8: enlaces dentro de un texto y
 * los elementos de los gráficos, que tienen su tabla equivalente.
 */
export async function destinosPequenos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const MINIMO = 44;
    const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';
    const pequenos: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement | SVGElement>(selector)) {
      if (el.closest('svg')) continue;
      if (el instanceof HTMLAnchorElement && el.closest('p')) continue;
      const casilla = el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');
      const destino = casilla ? (el.labels?.[0] ?? el) : el;
      const caja = destino.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) continue;
      if (caja.width < MINIMO - 0.5 || caja.height < MINIMO - 0.5) {
        const nombre = (destino.getAttribute('aria-label') ?? destino.textContent ?? '').trim().slice(0, 40);
        pequenos.push(`${destino.tagName.toLowerCase()} «${nombre}»: ${Math.round(caja.width)}×${Math.round(caja.height)}`);
      }
    }
    return pequenos;
  });
}

/** RWD5 (WCAG 1.4.4): elementos que recortan su contenido (overflow oculto y contenido mayor que la caja) */
export async function textoCortado(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ocultan = (valor: string) => valor === 'hidden' || valor === 'clip';
    const cortados: string[] = [];
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
      if (!(el instanceof HTMLElement) || el.closest('.solo-lectores, svg')) continue;
      const estilo = getComputedStyle(el);
      const cortaX = ocultan(estilo.overflowX) && el.scrollWidth > el.clientWidth + 1;
      const cortaY = ocultan(estilo.overflowY) && el.scrollHeight > el.clientHeight + 1;
      if (cortaX || cortaY) cortados.push(`${el.tagName.toLowerCase()}.${el.className} «${(el.textContent ?? '').trim().slice(0, 40)}»`);
    }
    return cortados;
  });
}
