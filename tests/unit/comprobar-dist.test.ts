import { describe, expect, it } from 'vitest';
import { analizar } from '../../scripts/comprobar-dist.ts';

const CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'" />';
const jwt = (payload: object) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.firmafirmafirmafirma`;

describe('comprobar-dist', () => {
  it('acepta un index.html limpio con CSP y scripts externos', () => {
    const html = `<head>${CSP}<script type="module" src="/assets/a.js"></script></head>`;
    expect(analizar('index.html', html)).toEqual([]);
  });

  it('detecta una secret key de Supabase', () => {
    expect(analizar('assets/a.js', 'const k="sb_secret_N7xQ2mVb9KpL4tRw8ZcY1dHf"')).toHaveLength(1);
  });

  it('no confunde el prefijo que usa supabase-js en su código con una clave', () => {
    const codigoLibreria = 'wo=e=>e.startsWith(`sb_publishable_`)||e.startsWith(`sb_secret_`),To=`sb_temp_`';
    expect(analizar('assets/a.js', codigoLibreria)).toEqual([]);
  });

  it('detecta un JWT con rol service_role y deja pasar uno anon', () => {
    expect(analizar('assets/a.js', `k="${jwt({ role: 'service_role' })}"`).join()).toMatch(/JWT/);
    expect(analizar('assets/a.js', `k="${jwt({ role: 'anon' })}"`)).toEqual([]);
  });

  it('detecta scripts, estilos y manejadores inline', () => {
    const html = `${CSP}<script>alert(1)</script><style>a{}</style><p style="x" onclick="y"></p>`;
    expect(analizar('index.html', html)).toHaveLength(4);
  });

  it('exige la CSP en index.html', () => {
    expect(analizar('index.html', '<head></head>')).toEqual(['index.html: falta la etiqueta meta CSP']);
  });
});
