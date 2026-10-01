// Revisa el build antes de publicarlo (SPEC S5): sin secretos, sin código inline y con la CSP.
// Uso: node scripts/comprobar-dist.ts [carpeta]   (por defecto, dist)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const JWT = /eyJ[\w-]{10,}\.(eyJ[\w-]{10,})\.[\w-]{10,}/g;

function esJwtDeServicio(payloadBase64: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as { role?: unknown };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export function analizar(nombre: string, contenido: string): string[] {
  const problemas: string[] = [];
  if (contenido.includes('sb_secret_')) problemas.push(`${nombre}: contiene una secret key de Supabase (sb_secret_)`);
  if (/service_role/.test(contenido)) problemas.push(`${nombre}: menciona service_role`);
  for (const m of contenido.matchAll(JWT)) {
    if (m[1] && esJwtDeServicio(m[1])) problemas.push(`${nombre}: contiene un JWT con rol service_role`);
  }

  if (nombre.endsWith('.html')) {
    for (const m of contenido.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const [, atributos = '', cuerpo = ''] = m;
      if (!/\bsrc=/.test(atributos) || cuerpo.trim() !== '') problemas.push(`${nombre}: script inline`);
    }
    if (/<style\b/i.test(contenido)) problemas.push(`${nombre}: bloque <style> inline`);
    if (/\sstyle\s*=/i.test(contenido)) problemas.push(`${nombre}: atributo style inline`);
    if (/\son[a-z]+\s*=/i.test(contenido)) problemas.push(`${nombre}: manejador de evento inline (on…=)`);
    if (nombre.endsWith('index.html') && !/http-equiv="Content-Security-Policy"/.test(contenido)) {
      problemas.push(`${nombre}: falta la etiqueta meta CSP`);
    }
  }
  return problemas;
}

function* archivos(carpeta: string): Generator<string> {
  for (const entrada of readdirSync(carpeta)) {
    const ruta = join(carpeta, entrada);
    if (statSync(ruta).isDirectory()) yield* archivos(ruta);
    else if (/\.(html|js|mjs|css|json|txt|map)$/.test(entrada)) yield ruta;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const carpeta = process.argv[2] ?? 'dist';
  const problemas = [...archivos(carpeta)].flatMap((ruta) =>
    analizar(relative(carpeta, ruta).split(sep).join('/'), readFileSync(ruta, 'utf8')),
  );
  if (problemas.length > 0) {
    console.error(`comprobar-dist: ${problemas.length} problema(s)\n- ${problemas.join('\n- ')}`);
    process.exit(1);
  }
  console.log('comprobar-dist: OK');
}
