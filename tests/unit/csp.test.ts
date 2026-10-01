import { describe, expect, it } from 'vitest';
import { construirCsp } from '../../config/csp';

describe('construirCsp', () => {
  it('parte de default-src none y no permite inline ni eval de JS', () => {
    const csp = construirCsp();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toMatch(/'unsafe-eval'/);
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('solo añade el origen de Supabase a connect-src', () => {
    const csp = construirCsp('https://abcd.supabase.co/rest/v1');
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co;");
  });

  it('sin Supabase configurado, connect-src es solo self', () => {
    expect(construirCsp()).toContain("connect-src 'self';");
  });

  it('con Supabase en HTTPS fuerza HTTPS en todo', () => {
    expect(construirCsp('https://abcd.supabase.co')).toContain('upgrade-insecure-requests');
  });

  it('el Supabase local de pruebas (http en loopback) no fuerza HTTPS', () => {
    const csp = construirCsp('http://127.0.0.1:54321');
    expect(csp).toContain("connect-src 'self' http://127.0.0.1:54321");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('rechaza un Supabase en http fuera de loopback', () => {
    expect(() => construirCsp('http://abcd.supabase.co')).toThrow(/HTTPS/);
  });
});
