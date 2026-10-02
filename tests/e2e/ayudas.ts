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
