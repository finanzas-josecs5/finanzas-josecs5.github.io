# Finanzas personales

Web privada de finanzas para dos personas: gastos e ingresos (a mano o desde la foto del ticket), gastos comunes de pareja y piso con reparto y saldo, cartera de fondos indexados, simulador frente a una cuenta remunerada y consejos explicados.

- **Web:** https://finanzas-josecs5.github.io
- **Especificación:** [`SPEC.md`](SPEC.md) · **Plan y tareas:** [`tasks/`](tasks/) · **Seguridad:** [`docs/seguridad.md`](docs/seguridad.md)
- **Coste:** 0 € (GitHub Pages + Supabase Free).

## Cómo funciona

| Pieza | Qué es |
|---|---|
| Frontend | SPA estática (Vite + Preact + TypeScript) en GitHub Pages, con CSP estricta y Trusted Types |
| Datos | Supabase Free (Postgres + Auth) en la UE; cada tabla con RLS (por usuario o por espacio) |
| OCR | Tesseract.js alojado en el propio sitio: las fotos se leen en el navegador y nunca se suben |
| Inflación | El CI descarga cada día la serie IPC290750 del INE y la publica en `/datos/ipc.json` |

## Desarrollo

```
npm ci --ignore-scripts
npm run dev            # Vite (sin CSP); apunta al Supabase de las variables VITE_*
npm run verificar      # lint + tipos + tests unitarios con cobertura (obligatorio antes de cada push)
npm run build          # tipos + motor OCR + IPC del INE + build con la CSP de producción
npm run test:e2e       # Playwright (375/768/1280) contra el build; los flujos con datos solo en CI
```

Los tests de base de datos (pgTAP) y los e2e con datos se ejecutan en GitHub Actions contra un **Supabase local efímero** (`supabase start`), nunca contra producción.

## Despliegue

1. Cada push a `main` ejecuta el CI: auditoría, lint, tests, build, comprobación de `dist/`, pgTAP y e2e.
2. Si todo pasa, se publica en GitHub Pages. También se publica cada día a las 07:00 UTC para refrescar la inflación.
3. **Migraciones:** se validan en CI y se aplican a producción a mano (conector de Supabase o `supabase db push`), alineando la versión con el nombre del archivo. Después se revisa el Security Advisor.

## Trazabilidad: criterios de aceptación (SPEC §6) → tests

| CA | Qué se comprueba | Test |
|---|---|---|
| CA1.1 | Sin sesión, todo lleva a Entrar | `tests/e2e/acceso.spec.ts` |
| CA1.2 | Registro público desactivado | `tests/e2e/mfa.spec.ts` |
| CA1.3 | Cambio de contraseña obligatorio en el primer acceso | `acceso.spec.ts`, `supabase/tests/002_primer_acceso.test.sql` |
| CA1.4 | Con MFA activado, sin código no hay datos | `mfa.spec.ts`, `001_espacios.test.sql` |
| CA1.5 | Cierre de sesión a los 30 min | `acceso.spec.ts`, `tests/unit/acceso.test.ts` |
| CA2.1–CA2.4 | Privacidad entre usuarios y espacios; anon sin acceso | `supabase/tests/001`–`010` (pgTAP), `espacios.spec.ts` |
| CA3.1–CA3.2 | Prorrateo de 14 pagas; caja real frente a prorrateada | `tests/unit/resumen.test.ts`, `resumen.spec.ts` |
| CA4.1–CA4.5 | Alta rápida, comercio → categoría, recurrencias, importes | `movimientos.spec.ts`, `recurrentes.spec.ts`, `nucleo.test.ts`, `recurrencias.test.ts` |
| CA5.1–CA5.4 | Extracción de importe, fecha y comercio del ticket | `tests/unit/extraer.test.ts` |
| CA5.5–CA5.6 | Tarjetas para revisar; la imagen no sale del navegador | `tests/e2e/foto.spec.ts` |
| CA6.1–CA6.8 | Reparto, saldo, saldar, mi parte, edición cruzada y auditoría | `reparto.test.ts`, `saldo.test.ts`, `miParte.test.ts`, `007_reparto.test.sql`, `008_liquidaciones.test.sql`, `reparto.spec.ts`, `comun.spec.ts` |
| CA7.1–CA7.2 | Resumen del mes; medias con meses completos | `resumen.test.ts`, `historico.test.ts`, `resumen.spec.ts` |
| CA8.1–CA8.5 | ISIN, TIR, recordatorios, valor desde captura, liquidez | `cartera.test.ts`, `recordatorios.test.ts`, `fondos.spec.ts`, `recordatorios.spec.ts` |
| CA9.1–CA9.2 | Simulador: escenarios, gráfico, tabla; fuente de la inflación | `simulador.test.ts`, `inflacion.test.ts`, `simulador.spec.ts` |
| CA10.1–CA10.2 | Inflación del INE validada, con respaldo y aviso de desactualizada | `ipc.test.ts`, `inflacion.test.ts` |
| CA11.1–CA11.2 | Cada regla se dispara según su umbral; explicación accesible | `consejos.test.ts`, `consejos.spec.ts` |
| CA12.1 | Exportar cifrado, borrar e importar devuelve el mismo estado | `copia.test.ts`, `copia.spec.ts` |
| RWD1–RWD8 | Sin scroll horizontal, destinos táctiles, axe AA, reflujo | todos los e2e (375/768/1280, dos temas), `rwd.spec.ts` |

## Fiscalidad

Los cálculos fiscales del simulador están marcados **[por verificar]**: escala del ahorro (Ley 35/2006 del IRPF, arts. 66 y 76, con la Ley 7/2024), tributación anual de los intereses y diferimiento por traspaso de fondos. Fuentes en `SPEC.md` §7.5. La app es orientativa: no es asesoramiento financiero y nunca ejecuta operaciones.
