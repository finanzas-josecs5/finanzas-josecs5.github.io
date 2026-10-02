# Seguridad

Resumen operativo de SPEC §3 (modelo de amenazas) y §8 (requisitos). Estado a 2026-10-02.

## Qué se protege y cómo

| Riesgo | Control | Dónde |
|---|---|---|
| Ver datos de otra persona | RLS en todas las tablas: por usuario (nómina, fondos, liquidez, ajustes) o por espacio (`privado.es_miembro`). Claves foráneas compuestas para no apuntar a filas ajenas | `supabase/migrations/`, tests pgTAP `supabase/tests/` |
| Registro de desconocidos | Registro público desactivado; las cuentas las crea el administrador | Supabase Auth, `config.toml` |
| Robo de contraseña | Contraseñas de 12+ caracteres con mayúscula, minúscula, número y símbolo; MFA TOTP opcional exigido por una política restrictiva (`privado.cumple_mfa`) | `001_espacios.sql`, `src/acceso/` |
| Sesión olvidada abierta | Cierre a los 30 min sin uso, también sin conexión (se borra la sesión local) | `src/acceso/inactividad.ts`, `sesion.ts` |
| XSS | Nada se renderiza como HTML (JSX, lint `no-unsanitized`, sin `dangerouslySetInnerHTML`); CSP sin `unsafe-inline` ni `unsafe-eval`; Trusted Types con una sola política que solo admite `/ocr/worker.min.js` | `config/csp.ts`, `eslint.config.js`, `src/ocr/tt-policy.ts` |
| Fuga de datos a terceros | `connect-src` solo al propio sitio y a Supabase; sin CDN, analítica ni fuentes externas; el OCR y la inflación se sirven desde el propio sitio | `config/csp.ts`, e2e `foto.spec.ts` |
| Cadena de suministro | Pocas dependencias con versión exacta y lockfile; `npm ci --ignore-scripts`; `npm audit` en cada build; Dependabot con 7 días de espera; acciones fijadas por SHA y solo de GitHub; CLI de Supabase verificada por hash | `package.json`, `.github/` |
| Secretos en el repo | Repo tratado como público: secret scanning con push protection; el CI falla si `dist/` contiene `sb_secret_…`, un JWT de `service_role` o código inline | `scripts/comprobar-dist.ts` |
| Copias en disco | Exportación cifrada por defecto (AES-GCM 256, PBKDF2-SHA256 de 600.000 iteraciones) | `src/copia/cifrado.ts` |

## Lo que GitHub Pages no permite (sin cabeceras propias)

| Protección | Mitigación |
|---|---|
| `frame-ancestors` / `X-Frame-Options` | Antiframe: el CSS oculta la página si está dentro de un iframe (`src/antiframe.ts`) |
| HSTS propio | «Enforce HTTPS» en Pages (redirige HTTP a HTTPS), la cabecera `Strict-Transport-Security: max-age=31556952` que pone GitHub Pages (1 año, sin `includeSubDomains` ni `preload`) y `upgrade-insecure-requests`. `github.io` **no** está en la lista de precarga HSTS de Chromium (comprobado el 2026-10-02 en `transport_security_state_static.json` y en hstspreload.org): ver riesgo aceptado 10 |
| `report-to` de CSP | Los e2e fallan ante cualquier violación de CSP |
| `Permissions-Policy`, COOP | La app no usa APIs sensibles; enlaces externos con `rel="noopener noreferrer"` |

## Riesgos aceptados

1. Supabase y el administrador pueden leer los datos (no hay cifrado en el cliente, por decisión).
2. Sin bloqueo de cuenta por intentos fallidos ni comprobación de contraseñas filtradas (son de los planes Team y Pro). Por eso el Security Advisor muestra siempre el aviso `auth_leaked_password_protection`: es el único aviso aceptado.
3. El cierre por inactividad es del cliente; un token robado vale hasta su caducidad (1 h) o el cierre de sesión.
4. Un frontend malicioso (cuenta de GitHub o dependencia comprometidas) podría leerlo todo; la CSP no impide exfiltrar navegando.
5. Token de sesión en `localStorage` (origen propio `finanzas-josecs5.github.io`, separado de otras webs).
6. `'wasm-unsafe-eval'` en la CSP por el OCR (solo habilita WebAssembly, no `eval()`).
7. En los espacios compartidos, cualquiera de los dos edita o borra cualquier gasto (se muestra quién creó y modificó; sin historial).
8. El plan Free pausa el proyecto tras ~7 días sin uso y no tiene copias PITR: la copia de seguridad es la exportación.
9. El workflow programado se desactiva tras 60 días sin actividad; la app avisa si la inflación tiene más de 45 días.
10. Sin precarga HSTS, la **primera** visita escrita como `http://` o sin esquema en un navegador que nunca ha abierto la app podría interceptarse en una red hostil antes de la redirección a HTTPS. Desde la primera visita por HTTPS, el navegador recuerda HTTPS durante un año. Mitigación: abrir siempre la app desde un marcador o un acceso directo con `https://`.

## Rutina

- Después de cada migración: Security Advisor de Supabase sin avisos nuevos (el de contraseñas filtradas es el único aceptado, ver riesgo 2).
- Cada mes: exportar una copia cifrada y guardarla.
- Revisar los PR de Dependabot (el CI completo se ejecuta en cada uno).
