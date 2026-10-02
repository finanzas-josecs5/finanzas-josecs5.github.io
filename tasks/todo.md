# Tareas: Finanzas personales

> Fuente: `SPEC.md` v0.6 y `tasks/plan.md`. «CAx.y» hace referencia a los criterios de aceptación de la spec (§6).
> En **todas** las tareas, «Verificación» incluye además: `npm run lint && npm run typecheck && npm test && npm run build` en verde.

---

## Fase 1: Cimientos

### T1. Esqueleto del proyecto  ·  M  ✅
Vite + Preact + TS strict, ESLint (con `no-unsanitized`), Vitest, `.gitignore` y `.nvmrc` (24). Una página «Hola» con tema claro u oscuro mediante tokens CSS. Plugin de Vite que inyecta la CSP meta (S12) **solo en el build de producción**.
- [x] `npm run build` genera `dist/` con la etiqueta meta CSP, sin scripts ni estilos inline
- [x] El lint falla si se usa `innerHTML` o `dangerouslySetInnerHTML` (test con un archivo de prueba)
- [x] El tema sigue a `prefers-color-scheme`
- **Verificación:** `npm run build && npm run preview` y revisión manual de la CSP en DevTools
- **Depende de:** —
- **Archivos:** `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/ui/tema.css`

### T2. CI/CD y primer despliegue  ·  M  ✅
Workflow con los jobs `check` (audit, lint, typecheck, test), `build` y `deploy` (S3, S4). Las acciones van fijadas por SHA. El script `comprobar-dist.mjs` cubre S5. `dependabot.yml`.
- [x] Un push a `main` publica la página en `https://finanzas-josecs5.github.io` por HTTPS
- [x] El workflow tiene `permissions: {}` y permisos mínimos por job, y todas las `uses:` van con SHA de 40 caracteres
- [x] `comprobar-dist` falla con un *fixture* que contiene `sb_secret_` o `<script>` inline
- **Verificación:** run verde en Actions y la URL cargando
- **Depende de:** T1 y las **acciones manuales** (organización, repo, Pages, ajustes de seguridad del repo, §11 de la spec)
- **Archivos:** `.github/workflows/deploy.yml`, `.github/dependabot.yml`, `scripts/comprobar-dist.mjs`

### T3. Base de e2e: CSP, axe y antiframe  ·  M  ✅
Playwright con proyectos de 375×812, 768×1024 y 1280×800 sobre `vite preview`. Un helper que falla ante cualquier violación de CSP o error de consola. axe en tema claro y oscuro. Antiframe (S15). Comprobación de RWD1.
- [x] El e2e falla si se inyecta un script inline a propósito
- [x] La página dentro de un iframe queda oculta, y fuera de él se ve
- [x] axe sin violaciones, y sin scroll horizontal en las tres anchuras
- **Verificación:** `npm run test:e2e` en local y en CI
- **Depende de:** T2
- **Archivos:** `playwright.config.ts`, `tests/e2e/base.spec.ts`, `tests/e2e/ayudas.ts`, `src/antiframe.ts`, `src/ui/tema.css`

### T4. Prueba de concepto del OCR  ·  M · **RIESGO ALTO**
Tesseract.js con el worker, el core y `spa.traineddata` copiados a `public/ocr/` (`copiar-ocr.ts`), `workerBlobURL:false` y la política de Trusted Types `default`, que solo admite la URL del worker. Una página temporal `#/lab/ocr` que lee un ticket sintético.
- [x] Con la CSP real (S12) se reconoce el texto de un ticket sintético, con 0 violaciones de CSP (e2e)
- [ ] ⏳ PENDIENTE (prueba del usuario): medido en vuestros móviles: tamaño de la descarga y tiempo de la primera lectura y de las siguientes
- [ ] ⏳ PENDIENTE (prueba del usuario): comprobado qué ocurre con una foto HEIC desde iPhone
- **Verificación:** e2e y prueba manual en los dos móviles
- **Depende de:** T3
- **Archivos:** `scripts/copiar-ocr.mjs`, `src/ocr/motor.ts`, `src/ocr/tt-policy.ts`, `tests/e2e/ocr.spec.ts`, `tests/fixtures/ticket-sintetico-1.png`

### ✅ Checkpoint 1
- [ ] Web publicada con la CSP real, y e2e en verde a 375, 768 y 1280
- [ ] **Decisión sobre el OCR**: seguir como en la spec, o una alternativa que tendrías que aprobar
- [ ] Revisión contigo

---

## Fase 2: Datos y acceso

### T5. Núcleo: dinero, formato y normalización  ·  S  ✅
Tipo `Centimos`, `formatearEUR` (`useGrouping:'always'`), `parsearImporte`, `normalizarComercio` y utilidades de fechas y meses.
- [x] Casos de CA4.2 y CA4.5, y formato `"1.234,56 €"` / `"-0,50 €"` con U+00A0
- [x] Cobertura ≥ 90 %
- **Verificación:** `npm test -- nucleo`
- **Depende de:** T1
- **Archivos:** `src/nucleo/{dinero,formato,normalizar,fechas}.ts`, `tests/unit/nucleo.test.ts`

### T6. Base de datos: espacios, miembros y RLS  ·  M  ✅ (migraciones 001 y 002 aplicadas en producción el 2026-10-01; Security Advisor sin avisos)
Supabase CLI (`supabase init`) y la migración 001:
- `espacios` y `miembros`;
- esquema `privado` con `es_miembro()`;
- trigger que crea el espacio individual al dar de alta un usuario;
- *event trigger* que activa RLS;
- política restrictiva de MFA;
- se quitan todos los permisos a `anon`;
- columnas de auditoría `creado_por` y `actualizado_por` fijadas por trigger.

Job `db-tests` en CI con `supabase start` y `supabase test db`.
- [x] pgTAP: CA2.2, CA2.4 y el usuario B no ve el espacio individual de A
- [x] pgTAP: `aal1` con factor verificado da 0 filas (parte de CA1.4)
- [x] El job `db-tests` está en verde en CI
- **Verificación:** job `db-tests` en CI (Supabase local efímero). Después, tú aplicas la migración a producción con `supabase db push`
- **Depende de:** T2 (crear el proyecto de producción en Supabase solo hace falta para el `db push`)
- **Archivos:** `supabase/config.toml`, `supabase/migrations/001_espacios.sql`, `supabase/tests/001_espacios.test.sql`, `.github/workflows/deploy.yml`

### T7. Login, rutas y layout  ·  M  ✅
Cliente de Supabase con las variables de entorno, router basado en hash, `#/entrar` y `#/cambiar-contrasena` (obligatorio en el primer acceso, mediante `user_metadata.debe_cambiar` o el *flag* equivalente en `app_metadata`), layout responsive (barra inferior por debajo de 768 px y lateral por encima), selector de espacio (de momento solo «Yo») y cierre por inactividad.
- [x] CA1.1, CA1.3 y CA1.5 (e2e con reloj simulado)
- [x] La navegación cambia según la anchura (375, 768 y 1280)
- **Verificación:** e2e en CI contra Supabase local, con usuarios de prueba creados en el propio job
- **Depende de:** T5 y T6
- **Archivos:** `src/datos/cliente.ts`, `src/ui/router.ts`, `src/acceso/{Entrar,CambiarContrasena,inactividad}.tsx`, `src/ui/Layout.tsx`, `tests/e2e/acceso.spec.ts`

### T8. MFA TOTP opcional  ·  S  ✅
En `#/ajustes/seguridad`: activar TOTP (QR y verificación) y desactivarlo. Paso `#/entrar/mfa` cuando `nextLevel = aal2`.
- [x] CA1.4 de principio a fin (e2e con un secreto TOTP de prueba)
- [x] CA1.2: `signUp` da error (con el registro desactivado)
- **Verificación:** e2e y prueba manual con una app TOTP
- **Depende de:** T7
- **Archivos:** `src/acceso/{Mfa,Seguridad}.tsx`, `tests/e2e/mfa.spec.ts`

### ✅ Checkpoint 2
- [ ] Login y MFA funcionando en producción
- [ ] **Acción manual:** crear tu cuenta y la de tu pareja
- [ ] Revisión contigo

---

## Fase 3: Mis movimientos

### T9. Gastos e ingresos a mano en «Yo»  ·  M  ✅ (migración 003 en producción)
Migración 002: `categorias`, `movimientos` y `comercios`, con claves foráneas compuestas, RLS y pgTAP, más la siembra de las categorías iniciales. Botón «+» → `#/movimientos/nuevo`, `#/movimientos` (lista filtrable) y `#/movimientos/:id`. La app propone la categoría según el comercio.
- [x] CA4.1 (≤ 4 toques) y CA4.3
- [x] pgTAP: el otro no puede leer ni escribir en mis movimientos, categorías o comercios
- [x] RWD8: `inputmode="decimal"` en el importe
- **Verificación:** e2e y CI de base de datos
- **Depende de:** T7
- **Archivos:** `supabase/migrations/002_movimientos.sql` (+ test), `src/datos/repos/movimientos.ts`, `src/movimientos/{Nuevo,Lista,Detalle}.tsx`, `src/movimientos/comercios.ts`

### T10. Recurrencias  ·  S  ✅ (migración 004 en producción)
Migración 003: `recurrencias`. Generación de ocurrencias por mes, ajuste y confirmación de cada una, y página `#/recurrentes`.
- [x] CA4.4
- [x] pgTAP de la tabla `recurrencias`
- **Verificación:** unitarios y e2e
- **Depende de:** T9
- **Archivos:** `supabase/migrations/003_recurrencias.sql` (+ test), `src/movimientos/recurrencias.ts`, `src/movimientos/Recurrentes.tsx`, `tests/unit/recurrencias.test.ts`

### T11. Nómina y resumen mensual  ·  M  ✅ (migración 005 en producción)
Migración 004: `nomina` (por usuario) y `ajustes`. Página `#/ajustes/nomina`. `#/resumen` con entradas, salidas (fijas y variables, por categoría) y disponible, en vista de caja real o prorrateada.
- [x] CA3.1, CA3.2 y CA7.1
- [x] pgTAP: `nomina` y `ajustes` invisibles para el otro usuario
- **Verificación:** unitarios y e2e
- **Depende de:** T9 y T10
- **Archivos:** `supabase/migrations/004_nomina_ajustes.sql` (+ test), `src/movimientos/{nomina,resumen}.ts`, `src/ui/Resumen.tsx`, `src/ajustes/Nomina.tsx`

### T12. Histórico con gráfico  ·  S  ✅ (en producción; sin migración)
`#/resumen/historico`: gráfico SVG de barras por mes con su tabla equivalente, y medias de 3 y 12 meses.
- [x] CA7.2 y RWD7 (el gráfico se adapta y tiene tabla)
- **Verificación:** unitarios y e2e a 375 y 1280
- **Depende de:** T11
- **Archivos:** `src/ui/graficos/Barras.tsx`, `src/ui/Historico.tsx`, `tests/unit/medias.test.ts`

### ✅ Checkpoint 3
- [ ] Usas la app a diario en «Yo» durante unos días
- [ ] Revisión contigo

---

## Fase 4: Lo común

### T13. Espacios compartidos  ·  M  ✅ (migración 006 en producción el 2026-10-02)
RPC `privado.anadir_miembro(espacio, email)`. Página `#/ajustes/espacios` para crear «Pareja» y «Piso» y añadir al otro por email. Selector de espacio completo: Yo, Pareja y Piso.
- [x] CA2.3 y CA2.2 en los espacios compartidos
- [x] La lista y el alta funcionan dentro del espacio seleccionado
- **Verificación:** pgTAP y e2e con dos usuarios de prueba
- **Depende de:** T9
- **Archivos:** `supabase/migrations/005_compartidos.sql` (+ test), `src/espacios/{Selector,Espacios}.tsx`, `src/datos/repos/espacios.ts`

### T14. Pagado por y reparto  ·  M  ✅ (migración 007 en producción el 2026-10-02)
Migración 006: `repartos`, triggers de pertenencia y de suma (*deferred*), y auditoría en `movimientos`. En el alta dentro de un espacio compartido: «Pagado por» y reparto (el 50/50 del espacio, editable por gasto). El detalle muestra «Creado por» y «Modificado por».
> Implementado como migración 007: porcentajes en `movimientos.reparto` (jsonb) validados por trigger, en lugar de una tabla `repartos` (la API no permite insertar movimiento y partes en una transacción). Las partes en céntimos las calcula `src/comun/reparto.ts`.
- [x] CA6.1, CA6.5, CA6.6, CA6.7 y CA6.8
- **Verificación:** unitarios (`repartir`), pgTAP y e2e
- **Depende de:** T13
- **Archivos:** `supabase/migrations/006_repartos.sql` (+ test), `src/comun/reparto.ts`, `src/movimientos/Nuevo.tsx`, `tests/unit/reparto.test.ts`

### T15. Saldo y «Saldar»  ·  M  ✅ (migración 008 en producción el 2026-10-02)
Migración 007: `liquidaciones`. Página `#/comun` con el saldo por espacio y `#/comun/:espacio/saldar`. En el resumen de «Yo» solo cuenta tu parte de los gastos comunes.
- [x] CA6.2, CA6.3 y CA6.4 (test de propiedades con generador propio, sin dependencias nuevas)
- **Verificación:** unitarios, pgTAP y e2e
- **Depende de:** T14 y T11
- **Archivos:** `supabase/migrations/007_liquidaciones.sql` (+ test), `src/comun/{saldo,liquidaciones}.ts`, `src/comun/{Comun,Saldar}.tsx`, `tests/unit/saldo.test.ts`

### ✅ Checkpoint 4
- [ ] **Prueba real con tu pareja** en Pareja y Piso: altas cruzadas, saldo y saldar
- [ ] Revisión contigo

---

## Fase 5: OCR

### T16. Extracción de datos del texto OCR (función pura)  ·  S  ✅
Función `extraer(texto) → {importe, fecha, comercio, confianza}`.
- [x] CA5.1, CA5.2, CA5.3 y CA5.4, con *fixtures* de texto
- [x] Cobertura ≥ 90 %
- **Verificación:** `npm test -- ocr`
- **Depende de:** T5
- **Archivos:** `src/ocr/extraer.ts`, `tests/unit/extraer.test.ts`, `tests/fixtures/ocr/*.txt`

### T17. Flujo «Desde foto»  ·  M  ✅ (en producción; falta la prueba en vuestros móviles)
`#/movimientos/foto`: varias imágenes → preprocesado → OCR → tarjetas editables (en ámbar si la confianza es baja) → «Guardar», «Guardar todos» o «Descartar». Los movimientos se guardan con `origen = 'ocr'`, se libera la memoria y se borra la página `#/lab/ocr` de T4.
- [x] CA5.5 y CA5.6 (inspección de la red en el e2e)
- [x] La propuesta de categoría por comercio también funciona aquí
- **Verificación:** e2e con 3 tickets sintéticos y prueba en los dos móviles
- **Depende de:** T4, T9 y T16
- **Archivos:** `src/ocr/{preprocesado,cola}.ts`, `src/ocr/Foto.tsx`, `src/ocr/Tarjeta.tsx`, `tests/e2e/foto.spec.ts`

---

## Fase 6: Cartera

### T18. Fondos, aportaciones y valoraciones  ·  M  ✅ (migración 009 en producción el 2026-10-02)
Migración 008 con RLS por usuario. Validación del ISIN, XIRR, `#/fondos`, `#/fondos/:id` (con gráfico de valor frente a aportado) y `#/fondos/:id/valorar`.
- [x] CA8.1 y CA8.2
- [x] pgTAP: la cartera es invisible para el otro usuario
- **Verificación:** unitarios, pgTAP y e2e
- **Depende de:** T7
- **Archivos:** `supabase/migrations/008_cartera.sql` (+ test), `src/cartera/{isin,xirr,cartera}.ts`, `src/cartera/{Fondos,Fondo,Valorar}.tsx`

### T19. Recordatorios, captura y liquidez  ·  S
Migración 009: `liquidez`. Página `#/ajustes/liquidez`. Recordatorios en el Resumen (fondos y liquidez de más de 30 días). Botón «Leer de captura», que reutiliza el motor OCR con un extractor de valor.
- [ ] CA8.3, CA8.4 y CA8.5
- **Verificación:** unitarios y e2e
- **Depende de:** T18 y T17
- **Archivos:** `supabase/migrations/009_liquidez.sql` (+ test), `src/cartera/recordatorios.ts`, `src/ocr/extraer-valor.ts`, `src/ajustes/Liquidez.tsx`

---

## Fase 7: Simulador

### T20. Cálculo del simulador (puro)  ·  S
`cuenta.ts`, `fondo.ts`, `impuestos.ts` (escala desde `escala-ahorro.json`, marcada **[por verificar]**) y `escenarios.ts`.
- [ ] Todos los casos de §7.4 de la spec
- [ ] Cobertura ≥ 90 %
- **Verificación:** `npm test -- simulador`
- **Depende de:** T5
- **Archivos:** `src/simulador/{cuenta,fondo,impuestos,escenarios}.ts`, `src/simulador/escala-ahorro.json`, `tests/unit/simulador.test.ts`

### T21. Inflación automática del INE  ·  S
`scripts/obtener-ipc.mjs` (serie IPC290750, último dato y media de 10 años, validación y respaldo). Paso en el workflow y `schedule` diario a las 07:00 UTC.
- [ ] CA10.1 con respuestas grabadas, válidas y no válidas
- [ ] El build en CI genera `dist/datos/ipc.json`
- **Verificación:** unitarios y un run de Actions lanzado a mano
- **Depende de:** T2 y T20
- **Archivos:** `scripts/obtener-ipc.mjs`, `src/simulador/ipc-respaldo.json`, `tests/unit/ipc.test.ts`, `tests/fixtures/ine/*.json`, `.github/workflows/deploy.yml`

### T22. Pantalla del simulador  ·  M
`#/simulador`: parámetros, selector de inflación (último dato, media de 10 años o manual, con fuente y fecha), gráfico SVG de líneas (3 escenarios y la cuenta), tabla anual y resumen neto. Los parámetros se guardan en `ajustes`.
- [ ] CA9.1, CA9.2 y CA10.2
- [ ] En 1280 px los parámetros y el gráfico aparecen lado a lado; en 375 px, uno encima del otro
- **Verificación:** e2e en las tres anchuras
- **Depende de:** T20, T21 y T11
- **Archivos:** `src/simulador/Simulador.tsx`, `src/ui/graficos/Lineas.tsx`, `src/simulador/inflacion.ts`, `tests/e2e/simulador.spec.ts`

---

## Fase 8: Consejos y copia

### T23. Motor de consejos  ·  M
Las 9 reglas de §7.6 como funciones puras. Página `#/consejos` y los 2 o 3 consejos principales en el Resumen, cada uno con «¿En qué se basa?». Umbrales editables en `#/ajustes/preferencias`. El consejo de exceso de liquidez enlaza al simulador con la cifra precargada.
- [ ] CA11.1 (cada regla se dispara o no según el umbral) y CA11.2
- **Verificación:** unitarios y e2e
- **Depende de:** T11, T15, T18 y T19
- **Archivos:** `src/consejos/{reglas,motor}.ts`, `src/consejos/Consejos.tsx`, `tests/unit/consejos.test.ts`

### T24. Exportar e importar  ·  M
Página `#/ajustes/copia`: JSON de exportación (individual y espacios compartidos), cifrado opcional activado por defecto (AES-GCM con PBKDF2 de 600.000 iteraciones) e importación con confirmación, sin pisar los espacios compartidos que ya existen.
- [ ] CA12.1, y el descifrado con una contraseña errónea falla
- **Verificación:** unitarios (cifrado) y e2e
- **Depende de:** T9 a T19
- **Archivos:** `src/copia/{exportar,importar,cifrado}.ts`, `src/copia/Copia.tsx`, `tests/unit/cifrado.test.ts`

---

## Fase 9: Cierre

### T25. Pasada final: responsive, accesibilidad y documentación  ·  M
Capturas de referencia por página y anchura (RWD6), zoom al 400 % y texto al 200 % (RWD5), y revisión de los destinos táctiles (RWD2). Además, `docs/seguridad.md` (amenazas y protecciones que no se pueden aplicar en Pages) y un README con la guía de uso y de despliegue.
- [ ] RWD1–RWD8 en verde
- [ ] Todos los CA de §6 de la spec tienen un test que pasa (tabla de trazabilidad en el README)
- [ ] La checklist §11 de la spec está completa, incluidos los puntos **[por verificar]**
- **Verificación:** CI completo en verde y revisión contigo
- **Depende de:** todas
- **Archivos:** `tests/e2e/visual.spec.ts`, `docs/seguridad.md`, `README.md`

### ✅ Checkpoint final
- [ ] Todos los criterios de éxito de la spec cumplidos
- [ ] Coste: 0 €
