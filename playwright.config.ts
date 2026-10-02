import { defineConfig, devices } from '@playwright/test';

const PUERTO = 4173;

// Anchuras de SPEC §9: 375 (móvil), 768 (tablet) y 1280 (escritorio)
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // En CI comparten 2 núcleos con el OCR (WebAssembly) y el Supabase local: más margen por test
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'movil-375', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true } },
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'escritorio-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  // Siempre contra el build real (con la CSP de producción), nunca contra el servidor de desarrollo
  webServer: {
    command: `npx vite preview --port ${PUERTO} --strictPort`,
    port: PUERTO,
    reuseExistingServer: !process.env.CI,
  },
});
