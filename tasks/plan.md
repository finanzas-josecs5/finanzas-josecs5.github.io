# Plan de implementación: Finanzas personales

> Basado en `SPEC.md` v0.6 (aprobada el 2026-10-01). Las tareas detalladas están en `tasks/todo.md`.
> Estado: **pendiente de revisión**.

## Resumen

SPA estática (Vite + Preact + TypeScript) publicada en `finanzas-josecs5.github.io`, con Supabase Free (Auth + Postgres con RLS) para dos usuarios.

Se construye **en vertical**: cada tarea entrega una función que se puede usar y probar de principio a fin (esquema, RLS, lógica, interfaz y tests). Las dos piezas más arriesgadas se prueban **al principio**:

- **el OCR bajo la CSP estricta con Trusted Types**;
- **las políticas RLS**.

## Decisiones de implementación

- **No hace falta Docker en tu ordenador.** Ahora mismo no lo tienes instalado. Los tests de RLS (pgTAP) se ejecutan **en GitHub Actions**, donde los runners de Ubuntu ya traen Docker y en un repo público no cuesta nada. Si más adelante instalas Docker Desktop, también podrás ejecutarlos en local.
- **Un solo proyecto de Supabase, el de producción** (decisión del usuario, 2026-10-01). Para no ensuciar tus datos reales:
  - **Tests de BD y e2e:** se ejecutan **en CI contra un Supabase local efímero** (`supabase start` dentro del runner, que trae Docker). Ahí se crean usuarios de prueba con la clave de servicio *local* del CLI, que es pública, conocida y solo existe en ese contenedor. Nunca se usan datos ni claves de producción en los tests.
  - **Desarrollo en tu ordenador:** `npm run dev` apunta al proyecto de producción con tu propia cuenta. Cualquier prueba manual de borrado o de importación se hace con datos de prueba o después de exportar.
  - **Migraciones:** se validan primero en CI (Supabase local más pgTAP) y después las aplicas tú a producción con `supabase db push`, siempre tras exportar los datos.
- **Git: commits directos a `main`** (decisión del usuario, igual que en los repos de viajes). Cada push ejecuta el CI completo y solo publica si todo está en verde. El ruleset de `main` bloquea el *force push* y el borrado, pero no exige PR.
- **Estrategia de las migraciones:** cada tarea que añade tablas trae su migración, sus políticas RLS y sus tests pgTAP en el mismo cambio. Nunca hay una tabla sin RLS ni sin tests.
- **Prueba de concepto del OCR antes de seguir (T4).** Si Tesseract no funciona con la CSP y Trusted Types, o tarda demasiado en el móvil, se decide en ese momento. Hay tres alternativas: relajar Trusted Types, cargar el OCR de forma diferida o usar otro motor. Cualquiera de ellas necesitaría tu aprobación porque cambia la spec.
- **Disciplina de cada commit:** lint, typecheck, tests y build en verde.

## Grafo de dependencias

```
T1 esqueleto ─┬─ T2 CI/CD + deploy ── T3 e2e/CSP/axe ── T4 spike OCR
              └─ T5 núcleo (dinero, formato)
T6 BD base + RLS (espacios) ── T7 login/rutas/layout ── T8 MFA
T7 ── T9 gastos manuales ─┬─ T10 recurrencias
                          ├─ T11 nómina + resumen ── T12 histórico
                          └─ T13 espacios compartidos ── T14 repartos ── T15 saldo/saldar
T4 + T9 ── T16 extracción OCR ── T17 flujo «Desde foto»
T7 ── T18 cartera ── T19 recordatorios + captura + liquidez (necesita T17)
T5 ── T20 cálculo simulador ── T21 IPC del INE ── T22 UI simulador
T11 + T15 + T19 ── T23 consejos
T9…T19 ── T24 exportar/importar
todo ── T25 pasada final responsive, a11y y documentación
```

## Fases y checkpoints

| Fase | Tareas | Checkpoint |
|---|---|---|
| 1. Cimientos | T1–T4 | La web vacía está publicada con la CSP real, los e2e corren a 375, 768 y 1280 px, y **hay que decidir sobre el OCR** |
| 2. Datos y acceso | T5–T8 | Login funcionando en producción, RLS de espacios en verde en CI y **creadas las dos cuentas reales** |
| 3. Mis movimientos | T9–T12 | Puedes usar la app a diario en tu espacio «Yo» |
| 4. Lo común | T13–T15 | **Prueba real con tu pareja** en Pareja y Piso |
| 5. OCR | T16–T17 | Gastos desde foto en vuestros móviles |
| 6. Cartera | T18–T19 | Fondos, liquidez y recordatorios |
| 7. Simulador | T20–T22 | Simulador con la inflación del INE automática |
| 8. Consejos y copia | T23–T24 | Consejos explicados y exportación cifrada |
| 9. Cierre | T25 | Se cumplen todos los criterios de §6 y §9 de la spec, y la checklist §11 está completa |

En cada checkpoint me detengo para que lo revises antes de seguir.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Tesseract.js no funciona con la CSP y Trusted Types (worker, WASM o `importScripts`) | Alto | Prueba de concepto en T4, antes de construir nada encima |
| El OCR va lento o pesa demasiado en el móvil (modelo de varios MB) | Medio | Se descarga solo la primera vez, se reduce la imagen a ~1600 px y se mide en T4 en vuestros móviles |
| Los tickets térmicos se leen mal | Medio | Siempre hay revisión manual; confianza baja marcada en ámbar |
| Error en una política RLS que exponga datos | Alto | Tests pgTAP «el otro no puede leer ni escribir» por cada tabla, ejecutados en CI en cada push, y Security Advisor |
| No tienes Docker en local | Bajo | Los tests de BD y los e2e se ejecutan en CI contra un Supabase local efímero |
| Desarrollar contra producción (no hay proyecto de dev) | Medio | Los tests nunca tocan producción. Exportar antes de cada `db push` o prueba destructiva. Las migraciones se validan antes en CI |
| Supabase Free pausa el proyecto | Bajo | Con uso diario no ocurre. Se reactiva con un clic |
| Las Actions programadas se desactivan tras 60 días sin actividad | Bajo | Aviso de dato desactualizado en la app; se reactivan con un clic |
| El INE cambia la serie del IPC | Bajo | Validación más respaldo, y el log del CI avisa |
| iPhone: fotos en HEIC | Medio | Se verifica en T4 que Safari convierte a JPEG al elegir el archivo. Si no, se avisa del formato |
| Una dependencia vulnerable bloquea el build (`npm audit`) | Bajo | Dependabot; actualizar o justificar la excepción |

## Preguntas abiertas

Ninguna. Git: commits directos a `main`. Supabase: solo producción, con los tests en CI contra un Supabase local efímero.
