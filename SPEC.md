# Spec: Finanzas personales (web privada)

> Estado: **v0.6, APROBADA** («OK» del 2026-10-01) · Plan de implementación en `tasks/plan.md`
> No se escribe código hasta que este documento esté aprobado.
> Las referencias a fiscalidad española van marcadas como **[por verificar]**, con la fuente oficial donde comprobarlas (§7.5).

---

## 1. Objetivos y usuarios

### 1.1 Objetivos

- **O1:** registrar ingresos y gastos (a mano o desde una foto) y ver cada mes cuánto queda para ahorrar o invertir, con histórico.
- **O2:** llevar los gastos comunes de pareja y del piso: quién pagó, reparto, saldo y liquidación.
- **O3:** seguir la cartera de fondos indexados (aportaciones, valor, TER y rentabilidad).
- **O4:** simular aportaciones en fondos frente a una cuenta remunerada, con escenarios, impuestos e inflación actualizada sola.
- **O5:** recibir consejos orientativos por reglas, que siempre muestran en qué datos se basan y cómo se han calculado.
- **Restricciones:**
  - **coste de 0 €/mes**;
  - **hosting en GitHub Pages**;
  - seguridad proporcional a unos datos que no son muy sensibles;
  - la app **nunca** ejecuta operaciones financieras.

### 1.2 Usuarios

| Usuario | Qué hace | Qué ve |
|---|---|---|
| **Tú (administrador)** | Usa la app y además gestiona GitHub, Supabase y las cuentas | Tu espacio «Yo» y los compartidos «Pareja» y «Piso» |
| **Tu pareja** | Usa la app | Su espacio «Yo» y los compartidos «Pareja» y «Piso» |

- Ninguno de los dos ve los datos individuales del otro: espacio «Yo», nómina, fondos, liquidez y ajustes.
- Los dos usáis la app desde el móvil y el ordenador. Los cambios se ven al recargar.

---

## 2. Comparativa de arquitecturas

| | **A) GitHub Pages + Supabase Free (Postgres + Auth + RLS)** ✅ **ELEGIDA** | **B) Local-first (IndexedDB) + copia cifrada** ❌ descartada |
|---|---|---|
| Datos compartidos entre los dos | ✅ Espacios compartidos protegidos por RLS | ❌ No es posible sin servidor. **Por esto se descarta** |
| Varios dispositivos | ✅ Automático | ❌ Exportar e importar a mano |
| Login | Email y contraseña, con MFA TOTP opcional | Frase de paso local |
| Riesgo de pérdida | Bajo: los datos están en el servidor, y además hay exportación | Alto: el navegador puede borrar los datos y la copia depende de ti |
| Superficie de ataque | Media: SDK, endpoint de auth público y token en el navegador | Mínima, sin red |
| Riesgos propios | Sin bloqueo de cuenta en Free; pausa del proyecto tras ~7 días sin uso; sin copias PITR; el proveedor puede ver los datos | Pérdida de datos; no hay forma de compartir |
| Complejidad | Media o alta: SQL, RLS y tests con Supabase local | Baja |
| **Coste mensual** | **0 €** en Free. Pro costaría ~25 $/mes (timeouts de sesión en el servidor y copias diarias). Team costaría ~599 $/mes (bloqueo por cuenta) | **0 €** |

---

## 3. Modelo de amenazas

### 3.1 Qué protegemos

| Activo | Por qué importa |
|---|---|
| **D1:** datos financieros individuales (nómina, gastos, fondos, liquidez) | Privacidad, incluso frente a tu pareja |
| **D2:** datos de los espacios compartidos | Solo para los dos miembros, y su integridad (que nadie altere los saldos) |
| **D3:** credenciales y sesiones | Dan acceso a D1 y D2 |
| **D4:** integridad del código desplegado | Quien controle el JavaScript controla todo lo demás |
| **D5:** disponibilidad y no pérdida de los datos | Años de histórico |

### 3.2 Frente a quién

| Adversario | Ataque típico | Controles |
|---|---|---|
| **Atacante en Internet** | Fuerza bruta o *credential stuffing* contra el login, o lectura directa de la API con la publishable key | Registro desactivado, límites por IP de Supabase, contraseñas de 12 caracteres o más, MFA opcional, RLS en todas las tablas y `anon` sin permisos |
| **XSS** a través de lo que se introduce o del texto del OCR | Robar el token de sesión o leer datos | Nunca se renderiza como HTML (JSX, lint `no-unsanitized`), CSP estricta y Trusted Types |
| **Cadena de suministro** (paquete npm o GitHub Action maliciosos) | Inyectar código que exfiltre datos | Pocas dependencias, lockfile, `npm ci --ignore-scripts`, `npm audit`, Dependabot, CodeQL y Actions fijadas por SHA |
| **Cuenta de GitHub comprometida** | Desplegar un frontend malicioso | 2FA con passkey o llave física, 2FA obligatorio en la organización, ruleset en `main` y entorno de despliegue restringido |
| **Cuenta de Supabase comprometida** | Leer o borrar toda la base de datos | 2FA en Supabase, contraseña de la base de datos en un gestor y exportaciones periódicas |
| **Tu pareja** (curiosidad, sin malicia) | Ver tus datos individuales | RLS por usuario y por espacio, con tests que intentan leer los datos del otro y deben fallar |
| **Dispositivo perdido u ordenador compartido** | Usar una sesión abierta | Cierre por inactividad a los 30 min, botón «Cerrar sesión» y MFA si se ha activado |
| **Webs de viajes en `josecs5.github.io`** | Compartir almacenamiento del navegador por estar en el mismo origen | Origen propio: `finanzas-josecs5.github.io` |
| **Clickjacking** | Engañar a alguien para que pulse dentro de un iframe | Antiframe en JavaScript, porque `frame-ancestors` no se puede aplicar en GitHub Pages |

### 3.3 Riesgos residuales (aceptados)

1. **Supabase y tú como administrador podéis leer los datos.** No hay cifrado en el cliente, por decisión tomada.
2. **No hay bloqueo de cuenta tras varios intentos fallidos** (es una función del plan Team). Se mitiga con los límites por IP, contraseñas fuertes y MFA.
3. **El cierre por inactividad solo existe en el cliente.** Un refresh token robado sigue siendo válido en el servidor hasta que se cierra la sesión.
4. **Un frontend malicioso** (por una cuenta de GitHub o una dependencia comprometidas) podría leerlo todo. La CSP no impide exfiltrar datos navegando a otra página.
5. **El token de sesión está en localStorage**, así que un XSS podría robarlo. Se reduce con la CSP y Trusted Types.
6. **Pausa del proyecto Free y ausencia de copias PITR.** Si el proyecto queda en pausa, la app deja de funcionar hasta que lo reactives. Si se pierden datos, solo se recuperan desde la última exportación.
7. **`'wasm-unsafe-eval'` en la CSP** por el OCR. Amplía un poco la superficie (permite ejecutar WASM), pero no habilita `eval()` de JavaScript.
8. **Dentro de un espacio compartido, cualquiera de los dos puede editar o borrar** los gastos comunes (decisión P1). Se mitiga mostrando «creado por» y «modificado por», que fija el servidor. No se guarda un historial de cambios.
9. **Workflow programado:** GitHub lo desactiva tras 60 días sin actividad, y la inflación dejaría de actualizarse. Aparece un aviso en la app.

---

## 4. Modelo de datos

**Cifrado:**

- No hay **cifrado a nivel de campo en el cliente** (decisión del 2026-10-01).
- Todos los campos viajan cifrados por **TLS** y se guardan con el **cifrado en reposo del disco de Supabase** (AES-256, gestionado por el proveedor).
- Las contraseñas las guarda Supabase Auth como hash bcrypt, y los secretos TOTP los gestiona Supabase Auth. Nunca están en tablas propias.
- El **archivo de exportación** sí va cifrado en el cliente (AES-GCM con PBKDF2) si se elige «Proteger con contraseña», que es la opción por defecto.

Todos los importes son `bigint` en **céntimos**. Todas las tablas tienen `id uuid`, `creado_en`, `actualizado_en`, `creado_por` y `actualizado_por`.

| Tabla | Campos | Ámbito y RLS | Cifrado en cliente |
|---|---|---|---|
| `espacios` | nombre, tipo (`individual`/`compartido`) | Visible para sus miembros | No |
| `miembros` | espacio_id, user_id, porcentaje_defecto (los del espacio suman 100) | Visible para los miembros del espacio. Solo se modifica mediante la RPC `anadir_miembro` | No |
| `categorias` | espacio_id, nombre, sentido (`entrada`/`salida`), orden | Espacio | No |
| `comercios` | espacio_id, nombre_normalizado, categoria_id | Espacio | No |
| `movimientos` | espacio_id, fecha, importe > 0, sentido, categoria_id, naturaleza (`fijo`/`variable`), concepto, comercio, pagado_por, recurrencia_id?, origen (`manual`/`ocr`) | Espacio | No |
| `repartos` | movimiento_id, user_id, importe_parte (la suma es igual al importe) | Espacio del movimiento | No |
| `liquidaciones` | espacio_id, de_user, a_user, importe, fecha | Espacio compartido | No |
| `recurrencias` | espacio_id, sentido, importe, categoria_id, naturaleza, concepto, frecuencia, cada_n, desde, hasta?, pagado_por | Espacio | No |
| `nomina` | user_id, pagas (12/14), neto_ordinario, neto_extra, meses_extra | **Solo el usuario** | No |
| `liquidez` | user_id, fecha, importe (saldo total en cuentas, apuntado a mano) | **Solo el usuario** | No |
| `fondos` | user_id, nombre, isin, ter | **Solo el usuario** | No |
| `aportaciones` | fondo_id, user_id, fecha, importe, participaciones? | **Solo el usuario** | No |
| `valoraciones` | fondo_id, user_id, fecha, valor | **Solo el usuario** | No |
| `ajustes` | user_id, simulador (jsonb), umbrales de consejos, minutos de inactividad (30), días del recordatorio de fondos (30) | **Solo el usuario** | No |

**Integridad:**

- claves foráneas compuestas, con `espacio_id` o `user_id`, para que nadie pueda apuntar a filas ajenas;
- triggers que comprueban que `pagado_por` y los repartos son miembros del espacio;
- un trigger *deferred* que comprueba que la suma de los repartos es igual al importe;
- el espacio individual se crea automáticamente al dar de alta al usuario.

---

## 5. Mapa de páginas

Las rutas usan *hash* (`#/…`) porque GitHub Pages no tiene *fallback* de SPA.

```
#/entrar                         Login (email + contraseña)
#/entrar/mfa                     Código TOTP (si está activado)
#/cambiar-contrasena             Obligatoria en el primer acceso

[Cabecera: selector de espacio Yo · Pareja · Piso | Ajustes | Cerrar sesión]
[Navegación: Resumen · Movimientos · Común · Fondos · Simulador | botón «+»]

#/resumen                        Mes actual del espacio: entradas, salidas, disponible, consejos y recordatorios
#/resumen/historico              Histórico por meses (gráfico y tabla)
#/movimientos                    Lista filtrable (mes, categoría, fijo/variable)
#/movimientos/nuevo              Alta rápida a mano
#/movimientos/foto               Adjuntar imágenes y revisar las tarjetas OCR
#/movimientos/:id                Editar o borrar
#/recurrentes                    Gastos e ingresos recurrentes
#/comun                          Saldos de Pareja y Piso
#/comun/:espacio/saldar          Registrar una liquidación
#/fondos                         Cartera: totales y lista de fondos
#/fondos/nuevo · #/fondos/:id    Detalle: aportaciones, valoraciones y gráfico
#/fondos/:id/valorar             Nuevo valor, a mano o leído de una captura
#/simulador                      Parámetros, escenarios, gráfico y tabla
#/consejos                       Todos los consejos con «¿En qué se basa?»
#/ajustes                        Índice de ajustes
#/ajustes/nomina · /liquidez · /categorias · /espacios · /seguridad (contraseña, MFA) · /copia (exportar, importar) · /preferencias
(ruta desconocida)               Redirige a #/resumen
```

---

## 6. Funcionalidades y criterios de aceptación

Todos los criterios se comprueban con un test automático: **[U]** unitario, **[R]** RLS (pgTAP) o **[E]** e2e (Playwright).

### F1. Acceso

- **CA1.1 [E]:** sin sesión, cualquier ruta redirige a `#/entrar`.
- **CA1.2 [R]:** `signUp` con la publishable key devuelve error, porque el registro está desactivado.
- **CA1.3 [E]:** en el primer acceso, la app obliga a cambiar la contraseña (mínimo 12 caracteres) antes de mostrar ningún dato.
- **CA1.4 [R]:** un usuario con un factor TOTP verificado y sesión `aal1` obtiene 0 filas en todas las tablas. Con `aal2` ve sus datos.
- **CA1.5 [E]:** tras 30 min sin interacción (con reloj simulado), la sesión se cierra, el estado se vacía y se vuelve a `#/entrar`.

### F2. Espacios y privacidad

- **CA2.1 [R]:** el usuario B obtiene 0 filas al consultar el espacio individual de A, su nómina, liquidez, fondos, aportaciones, valoraciones y ajustes. Cualquier insert, update o delete de B sobre ellos falla.
- **CA2.2 [R]:** alguien que no es miembro no puede leer ni escribir en un espacio compartido, ni añadirse a sí mismo a `miembros`.
- **CA2.3 [R]:** `anadir_miembro` falla si quien la invoca no es miembro del espacio.
- **CA2.4 [R]:** el usuario `anon` no tiene acceso a ninguna tabla.

### F3. Ingresos y nómina

- **CA3.1 [U]:** con 14 pagas, 2.000 € ordinario y 2.000 € extra → 2.333,33 €/mes prorrateado. Con 12 pagas → igual al neto ordinario.
- **CA3.2 [E]:** en junio y diciembre, la vista «caja real» incluye la paga extra y la vista «prorrateada» no.

### F4. Gastos a mano

- **CA4.1 [E]:** desde el botón «+», un gasto con un comercio conocido se guarda con **≤ 4 toques** más el importe.
- **CA4.2 [U]:** `"  MERCADONA, S.A. "` y `"Mercadona SA"` se normalizan a la misma clave.
- **CA4.3 [E]:** tras guardar «Mercadona → Supermercado», el siguiente alta con «Mercadona» propone «Supermercado».
- **CA4.4 [U]:** una recurrencia mensual del 1 de enero al 31 de marzo genera 3 ocurrencias, y ajustar una no cambia las demás.
- **CA4.5 [U]:** se aceptan `1.234,56`, `1234,56` y `1234.56`, y todos dan 123456 céntimos.

### F5. Gastos desde foto (OCR)

- **CA5.1 [U]:** con el texto «SUBTOTAL 10,00 / IVA 2,10 / TOTAL 12,10» se extrae 12,10 con confianza alta.
- **CA5.2 [U]:** con «TOTAL EUR 1.234,56» se extrae 1.234,56.
- **CA5.3 [U]:** un texto sin «TOTAL» da el importe mayor con confianza baja. Un texto vacío da una tarjeta vacía con confianza baja.
- **CA5.4 [U]:** la fecha `05/09/26` se interpreta como 2026-09-05.
- **CA5.5 [E]:** al adjuntar 3 tickets sintéticos salen 3 tarjetas, y no se guarda nada hasta pulsar «Guardar».
- **CA5.6 [E]:** durante el flujo OCR, el navegador no envía ninguna petición con la imagen. Solo hay peticiones a `/ocr/*` (el motor) y a Supabase (el gasto ya confirmado).

### F6. Gastos comunes

- **CA6.1 [U]:** 10,01 € al 50/50 pagado por A → B 5,00 € y A 5,01 €.
- **CA6.2 [U]:** A paga 100 € y B paga 30 €, ambos al 50/50 → «B debe 35,00 € a A». Tras saldar 35,00 € → 0,00 €.
- **CA6.3 [U]:** en el resumen individual de A, un gasto común de 100 € al 50/50 cuenta como 50,00 €.
- **CA6.4 [U] (propiedad):** para cualquier secuencia aleatoria de gastos y liquidaciones, la suma de los saldos de los miembros es 0.
- **CA6.5 [R]:** un reparto que no suma el importe, o un `pagado_por` que no es miembro, se rechaza.
- **CA6.6 [R]:** en un espacio compartido, B puede editar y borrar un gasto creado por A. Al editarlo, `actualizado_por` pasa a ser B (lo fija un trigger, no el cliente). [P1]
- **CA6.7 [U] [E]:** un gasto de 100 € con reparto 70/30 cambiado solo para ese gasto → partes de 70,00 y 30,00. El reparto por defecto del espacio no cambia. [P3]
- **CA6.8 [E]:** el detalle de un gasto compartido muestra «Creado por» y «Modificado por».

### F7. Resumen e histórico

- **CA7.1 [U]:** con datos de ejemplo, el resumen da las entradas, las salidas y el disponible esperados, desglosados por categoría y por fijo/variable.
- **CA7.2 [U]:** la media de 3 y 12 meses solo tiene en cuenta los meses completos.

### F8. Cartera

- **CA8.1 [U]:** el ISIN `IE00B4L5Y983` es válido; con el último dígito alterado no lo es.
- **CA8.2 [U]:** XIRR de −1.000 € el 2025-01-01 y +1.100 € el 2026-01-01 → 10,00 % (±0,01).
- **CA8.3 [E]:** si la última valoración tiene más de 30 días, aparece un recordatorio en el Resumen.
- **CA8.4 [U]:** el texto de una captura de ejemplo propone el valor correcto, y se pide confirmación antes de guardar.
- **CA8.5 [E]:** si la última `liquidez` tiene más de 30 días, aparece un recordatorio en el Resumen para actualizarla. [P2]

### F9. Simulador

- Los casos de §7.4 pasan.
- **CA9.1 [E]:** se muestran 3 escenarios y la cuenta, con un gráfico y una tabla equivalente.
- **CA9.2 [E]:** la inflación muestra la fuente, el periodo y si es avance o definitivo.

### F10. Inflación automática

- **CA10.1 [U]:** una respuesta del INE grabada genera el `ipc.json` esperado. Una respuesta no válida hace que se use el respaldo y quede un aviso en el log.
- **CA10.2 [E]:** si `obtenido` tiene más de 45 días, aparece el aviso de dato desactualizado.

### F11. Consejos

- **CA11.1 [U]:** cada regla de §7.6, con datos de *fixture*, se dispara o no según el umbral. Su `cálculo` contiene los valores concretos usados.
- **CA11.2 [E]:** cada consejo tiene un desplegable «¿En qué se basa?» accesible con teclado.

### F12. Copia

- **CA12.1 [E]:** exportar, borrar los datos individuales de prueba e importar con la contraseña devuelve el mismo estado. Con una contraseña errónea la importación falla.

---

## 7. Fórmulas del simulador y lógica de los consejos

### 7.1 Notación

| Símbolo | Significado |
|---|---|
| `C₀` | aportación inicial |
| `A` | aportación mensual |
| `N` | años |
| `M = 12N` | meses |
| `TAE` | TAE de la cuenta |
| `r` | rentabilidad bruta anual del fondo |
| `TER` | comisión total anual del fondo |
| `π` | inflación anual |

### 7.2 Cuenta remunerada

```
i = (1 + TAE)^(1/12) − 1
S ← C₀ ; I_año ← 0
para cada mes m = 1..M:
    interés ← S · i ; S ← S + interés + A ; I_año ← I_año + interés
    si m es múltiplo de 12:  S ← S − cuota_ahorro(I_año) ; I_año ← 0
resultado_neto = S
```

- Los intereses tributan **cada año** como rendimiento del capital mobiliario **[por verificar]**.
- Simplificaciones:
  - no se modela la retención del 19 % ni su regularización **[por verificar]**;
  - se supone que no hay otros rendimientos del ahorro ese año.

### 7.3 Fondo indexado

```
f = (1 + r)^(1/12) · (1 − TER)^(1/12)
V ← C₀ ;  para cada mes: V ← V · f + A
aportado = C₀ + A · M
ganancia = V − aportado
neto = V − cuota_ahorro(max(ganancia, 0))
```

- Solo se tributa **al reembolso**. Los traspasos entre fondos no tributan **[por verificar]**.
- El simulador supone un reembolso total en el año N.

**Escenarios por defecto:** r = 2 % (pesimista), 5 % (base) y 7 % (optimista). Son editables.

**Valor real:** `real = neto / (1 + π)^N`. Los impuestos se calculan siempre sobre importes nominales.

**Inflación:** «Último dato INE» por defecto, «Media 10 años INE» (media geométrica de los IPC de diciembre interanuales) o «Manual».

### 7.4 Escala del ahorro `cuota_ahorro(B)` **[por verificar]**

| Base liquidable del ahorro | Tipo |
|---|---|
| 0 – 6.000 € | 19 % |
| 6.000 – 50.000 € | 21 % |
| 50.000 – 200.000 € | 23 % |
| 200.000 – 300.000 € | 27 % |
| > 300.000 € | 30 % |

- Es un dato versionado en `src/simulador/escala-ahorro.json`, con el ejercicio y la fuente. Se aplica al ejercicio 2025 y siguientes, para residentes en territorio común (País Vasco y Navarra tienen normativa propia).

**Casos de prueba de valores conocidos:**

| Caso | Esperado |
|---|---|
| Cuenta: 100 €/mes al 2,5 % TAE, 1 año, sin impuestos | 1.213,69 € |
| Cuenta: 10.000 € al 2,5 %, 1 año | interés 250,00, cuota 47,50, neto 10.202,50 € |
| Fondo: 10.000 € al 7 %, TER 0, 10 años | 19.671,51 €; cuota 1.911,02 €; neto 17.760,49 € |
| `cuota_ahorro(10.000)` | 1.980,00 € |
| Tipo mensual de una TAE del 2,5 % | 0,0020598 |

### 7.5 Fuentes oficiales para verificar la fiscalidad

| Punto **[por verificar]** | Dónde comprobarlo |
|---|---|
| Escala del ahorro y tipos 2025+ (incluido el 30 % por encima de 300.000 €) | Ley 35/2006 del IRPF, arts. 66 y 76, texto consolidado en el BOE: https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764 (con la modificación de la Ley 7/2024, de 20 de diciembre), y el *Manual práctico de Renta* de la AEAT: https://sede.agenciatributaria.gob.es |
| Los intereses de una cuenta son rendimiento del capital mobiliario y se imputan cada año | LIRPF, art. 25.2 y art. 14, en el BOE (enlace anterior) |
| Retención del 19 % sobre intereses y reembolsos | LIRPF, art. 101, y Reglamento del IRPF (RD 439/2007), art. 90: https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820 |
| Ganancia patrimonial al reembolsar, y criterio FIFO para participaciones homogéneas | LIRPF, arts. 33–37, en el BOE |
| Diferimiento por traspaso entre fondos (requisitos; no se aplica a ETF) | LIRPF, art. 94.1.a, en el BOE, y el *Manual práctico de Renta* de la AEAT |
| Regímenes forales | Haciendas forales de Álava, Bizkaia, Gipuzkoa y Navarra (fuera de alcance) |

### 7.6 Lógica de los consejos

Los consejos son funciones puras: `regla(datos, umbrales) → Consejo | null`. Cada consejo incluye `datosUsados` (los valores concretos), `cálculo` (la fórmula con los números sustituidos) y `umbral`. Los gastos medios usan solo meses completos, y en el espacio «Yo» incluyen tu parte de lo común.

| Id | Datos | Cálculo | Se dispara si (umbral editable) | Mensaje (ejemplo) |
|---|---|---|---|---|
| `tasa-ahorro` | Entradas y salidas de los últimos 3 meses | `(E − S) / E` | < 10 % | «Ahorras el 6 % de tus ingresos (objetivo: 10 %)» |
| `colchon` | Última `liquidez` y gasto medio de 12 meses | `liquidez / gasto_medio` | < 3 meses | «Tu colchón cubre 2,1 meses de gastos» |
| `exceso-liquidez` | Lo mismo | `liquidez − 6 · gasto_medio` | > 0 y colchón > 6 meses | «Tienes 4.200 € por encima de 6 meses de gastos. Mira el simulador» (enlace con esa cifra precargada) |
| `ter-alto` | El TER de cada fondo | `TER` | > 0,5 % | «El TER de X es del 0,8 %; a 10.000 € son unos 80 €/año» |
| `categoria-sube` | Gasto por categoría en el mes anterior y media de los 3 meses previos | `(mes − media) / media` | > 20 % y media ≥ 30 € | «Restaurantes: +35 % frente a tu media» |
| `suscripciones` | Recurrentes de la categoría Suscripciones | `Σ importe · (12 / periodo_meses)` | > 0 (informativo) | «Tus suscripciones suman 312 €/año» |
| `saldo-pendiente` | Saldo del espacio y fecha de la última liquidación | días desde la última liquidación | saldo ≠ 0 y > 30 días | «Piso: saldo pendiente de 42,30 € desde hace 41 días» |
| `fondos-sin-valorar` | Última valoración por fondo | días desde la última valoración | > 30 días | «Actualiza el valor de X (hace 45 días)» |
| `liquidez-sin-actualizar` | Fecha de la última `liquidez` | días desde la última | > 30 días | «Actualiza tu liquidez (hace 34 días)» |

Todos los consejos llevan este pie: «Orientativo. No es asesoramiento financiero».

---

## 8. Requisitos de seguridad

### 8.1 Repositorio y CI/CD

- **S1:** el repo es público y nunca contiene secretos, `.env`, datos reales ni tickets reales. Hay un `.gitignore` configurado.
- **S2:** secret scanning con push protection, alertas y actualizaciones de seguridad de Dependabot (`npm` y `github-actions`), y CodeQL (configuración por defecto).
- **S3:** workflow con `permissions: {}`. `build` tiene `contents: read`; `deploy` tiene `pages: write` e `id-token: write`. Todas las acciones van **fijadas por SHA**.
- **S4:** el build hace `npm ci --ignore-scripts`, y si `npm audit --audit-level=moderate` encuentra algo, **falla**.
- **S5:** el CI falla si `dist/` contiene `sb_secret_`, `service_role`, un JWT con ese rol, scripts inline o estilos inline.
- **S6:** dependencias de ejecución: solo `preact`, `@supabase/supabase-js` y `tesseract.js`. Cualquier otra requiere aprobación.

### 8.2 Backend (Supabase)

- **S7:** registro público desactivado, y RLS activado en todas las tablas (también un *event trigger* que lo activa en las nuevas). `anon` no tiene permisos.
- **S8:** en el frontend solo van la URL y la *publishable key*. La *secret key* nunca se usa fuera del panel.
- **S9:** MFA TOTP opcional, exigido mediante una política restrictiva si el usuario tiene un factor verificado.
- **S10:** las funciones `security definer` viven en un esquema privado con `set search_path = ''`.
- **S11:** antes de cada migración, el Security Advisor de Supabase no muestra avisos.

### 8.3 Navegador

- **S12:** CSP mediante etiqueta meta en producción:
  ```
  default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self';
  img-src 'self' blob:; font-src 'self'; manifest-src 'self'; worker-src 'self';
  connect-src 'self' https://<ref>.supabase.co; base-uri 'none'; form-action 'none';
  object-src 'none'; require-trusted-types-for 'script'; trusted-types ocr-worker;
  upgrade-insecure-requests
  ```
  Sin CDN, sin analítica y sin terceros. Las fuentes y el motor del OCR se sirven desde el propio sitio.
- **S13:** nunca se renderiza como HTML ni lo que introduce el usuario ni el texto del OCR (lint `no-unsanitized`, sin `dangerouslySetInnerHTML`).
- **S14:** HTTPS: «Enforce HTTPS» en Pages, `upgrade-insecure-requests` y la precarga HSTS de `github.io` **[se verificará en hstspreload.org]**.
- **S15:** como no se pueden configurar cabeceras en Pages, se pierden varias protecciones. Así se mitiga cada una:

  | Protección | Mitigación |
  |---|---|
  | `frame-ancestors` / `X-Frame-Options` | Antiframe: el CSS oculta `html` y solo se muestra si `window.top === window.self` |
  | HSTS propio | S14 |
  | `report-to` | Tests e2e que fallan ante cualquier violación de CSP |
  | `Permissions-Policy`, COOP | La app no usa APIs sensibles. Los enlaces externos llevan `rel="noopener noreferrer"` |

  Además se añade `<meta name="referrer" content="no-referrer">`.
- **S16:** la sesión se cierra a los 30 min de inactividad. Las imágenes del OCR solo existen en memoria y se liberan al guardar o descartar.
- **S17:** el origen es propio (`finanzas-josecs5.github.io`), sin compartir almacenamiento con otras webs.

---

## 9. Requisitos responsive

Se prueba en **375 px** (móvil), **768 px** (tablet) y **1280 px** (escritorio), con proyectos de Playwright a 375×812, 768×1024 y 1280×800.

| Ancho | Navegación | Diseño |
|---|---|---|
| < 768 px | Barra inferior con 5 pestañas y botón «+» flotante | Una columna, con tarjetas y listas a ancho completo |
| 768 – 1279 px | Barra lateral compacta (icono y etiqueta) | Una o dos columnas según la página. El simulador muestra el gráfico encima y la tabla debajo |
| ≥ 1280 px | Barra lateral completa | Dos columnas: lista con su detalle (movimientos y fondos), y en el simulador los parámetros junto al gráfico. Ancho máximo del contenido de ~1200 px |

**Criterios** (comprobados en las tres anchuras y en las páginas principales):

- **RWD1:** sin scroll horizontal (`document.documentElement.scrollWidth ≤ clientWidth`).
- **RWD2:** los destinos táctiles miden al menos 44×44 px a 375 y 768.
- **RWD3:** la navegación es visible y funciona con teclado. El foco es visible.
- **RWD4:** axe no encuentra violaciones de WCAG 2.1 AA, ni en tema claro ni en oscuro.
- **RWD5:** a 1280 px con zoom al 400 % (equivalente a 320 px), el contenido se reajusta sin perder información (WCAG 1.4.10). Con el texto al 200 %, nada se corta (WCAG 1.4.4).
- **RWD6:** hay capturas de referencia por página y anchura, y una diferencia visual mayor que el umbral hace fallar el test.
- **RWD7:** los gráficos se redimensionan sin desbordarse y siempre tienen su tabla equivalente.
- **RWD8:** al tocar un campo de importe en el móvil se abre el teclado numérico (`inputmode="decimal"`).

**Estilo:**

- app bancaria moderna, con números tabulares;
- verde y rojo para entradas y salidas, **siempre acompañados de signo o icono**;
- modo claro u oscuro según `prefers-color-scheme`;
- se respeta `prefers-reduced-motion`.

---

## 10. Fuera de alcance y preguntas abiertas

### 10.1 Fuera de alcance

- IA de cualquier tipo;
- importar CSV o Excel del banco;
- tiempo real;
- espacios de más de 2 personas o compañeros de piso;
- guardar las imágenes;
- actualizar el valor de los fondos automáticamente;
- servicios de pago y dominio propio;
- regímenes forales;
- declaración de la renta;
- cálculo de retenciones de la nómina;
- ejecutar operaciones financieras;
- analítica;
- notificaciones push;
- PWA instalable (se puede valorar más adelante).

### 10.2 Preguntas abiertas

Ninguna. Las tres anteriores están resueltas:

- **P1 (resuelta: sí):** en los espacios compartidos, cada uno puede editar y borrar cualquier gasto, también los del otro. Se muestran «creado por» y «modificado por».
- **P2 (resuelta: sí):** la liquidez se apunta a mano en Ajustes → Liquidez, con un recordatorio mensual.
- **P3 (resuelta: sí):** el reparto se puede cambiar en cada gasto, con el del espacio (50/50) preseleccionado.

---

## 11. Checklist de acciones manuales (las haces tú; yo te guío en cada una)

### GitHub: cuenta y organización

- [ ] **2FA en tu cuenta de GitHub**, con passkey o llave física y una app TOTP de respaldo. Guarda los códigos de recuperación en tu gestor de contraseñas.
- [ ] Crear la organización gratuita **`finanzas-josecs5`**.
- [ ] Organización → Settings → Authentication security: **exigir 2FA a los miembros**.
- [ ] Si vas a dar acceso al repo a tu pareja, debe tener 2FA. No hace falta: ella solo usa la web.

### GitHub: repositorio `finanzas-josecs5/finanzas-josecs5.github.io` (público)

- [ ] Settings → **Pages**: Source = **GitHub Actions**, y marcar **Enforce HTTPS**.
- [ ] Settings → **Environments** → `github-pages`: *Deployment branches* = solo `main`.
- [ ] Settings → **Actions → General**:
  - *Workflow permissions* = **Read repository contents**;
  - desmarcar «Allow GitHub Actions to create and approve pull requests»;
  - en la política de acciones permitidas, **exigir que estén fijadas por SHA completo** si la opción está disponible;
  - *Fork pull request workflows* = exigir aprobación.
- [ ] Settings → **Rules → Ruleset** para `main`: bloquear *force push* y borrado, y exigir que pasen los checks del CI.
- [ ] Settings → **Code security**:
  - **Secret scanning** y **Push protection**;
  - **Dependabot alerts** y **Dependabot security updates**;
  - **CodeQL** (configuración por defecto);
  - **Private vulnerability reporting**.
- [ ] Settings → **Secrets and variables → Actions → Variables** (no Secrets): `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Comprobar que **no existe ningún Secret** con la *secret key* de Supabase.

### Supabase

- [ ] **2FA en tu cuenta de Supabase** (Account → Security). Opcional pero recomendable: exigir MFA en la organización de Supabase.
- [ ] Crear el proyecto en el **plan Free**, en una **región de la UE** (por ejemplo, Frankfurt). Guardar la contraseña de la base de datos en tu gestor.
- [ ] Authentication → Sign In / Providers:
  - **desactivar «Allow new users to sign up»**;
  - Email activado, con contraseña de 12 caracteres como mínimo y con letras, números y símbolos.
- [ ] Authentication → **Multi-Factor**: activar **TOTP** (inscripción y verificación).
- [ ] Authentication → URL Configuration: *Site URL* = `https://finanzas-josecs5.github.io`, y *Redirect URLs* solo esa.
- [ ] Authentication → Rate Limits: revisar que los límites de inicio de sesión y de verificación tienen valores bajos.
- [ ] Authentication → Users: **crear tu usuario y el de tu pareja** con *Auto Confirm* y una contraseña temporal. Pasársela a tu pareja por un canal seguro, no por el mismo chat en el que se comparte el email.
- [ ] Project Settings → API: copiar la **URL** y la **publishable key** a las variables de GitHub. **No copiar la secret key a ningún sitio.**
- [ ] Después de cada migración: Advisors → **Security Advisor** sin avisos.
- [ ] Cada mes: **exportar** los datos desde la app y guardar el archivo cifrado.

### En tu ordenador

- [ ] Instalar **Node 24 LTS**, **Docker Desktop** (para Supabase local y los tests de RLS) y la **Supabase CLI**.
- [ ] Ejecutar `supabase login` y `supabase link` con tu proyecto. El token de acceso se queda en tu máquina y no se sube al repo.

### Al terminar

- [ ] Probar el login, el TOTP y un gasto desde foto en vuestros dos móviles.
- [ ] Verificar en hstspreload.org que `github.io` está precargado.
- [ ] Verificar los puntos **[por verificar]** de §7.5 en el BOE y en la AEAT.

---

## Anexo: guía de desarrollo

### Stack

| Pieza | Elección |
|---|---|
| Lenguaje | TypeScript strict |
| Build | Vite (SPA estática, `base: '/'`) |
| UI | Preact, con router propio basado en hash |
| Gráficos | SVG propio |
| Backend | `@supabase/supabase-js` |
| OCR | `tesseract.js`, con el core WASM y `spa.traineddata` en `public/ocr/` |
| Tests | Vitest, Playwright + @axe-core/playwright, pgTAP |
| Lint | ESLint + typescript-eslint + eslint-plugin-no-unsanitized |
| Node | 24 LTS |

### Inflación automática

- El script `scripts/obtener-ipc.mjs` descarga en el build la serie del INE `IPC290750` (variación anual del IPC general, base 2025):
  - consulta: `https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/IPC290750?nult=130&tip=AM`;
  - comprobado el 2026-10-01: septiembre de 2026 = 4,9 % (Avance) y media de 10 años = 2,50 %.
- Se ejecuta en cada push y cada día a las 07:00 UTC, y genera `dist/datos/ipc.json`.
- Si la descarga falla, se usa el respaldo `src/simulador/ipc-respaldo.json`.

### Comandos

```
npm ci --ignore-scripts
npm run dev | build | preview
npm test               # vitest run --coverage
npm run test:e2e       # playwright (375/768/1280) sobre el build real + axe
npm run lint           # eslint . --max-warnings 0
npm run typecheck
npm run audit          # npm audit --audit-level=moderate
npx supabase start     # requiere Docker
npx supabase test db   # pgTAP (RLS)
npx supabase db push   # migraciones (manual)
```

### Estructura

```
src/  nucleo/ datos/ acceso/ espacios/ movimientos/ comun/ ocr/ cartera/ simulador/ consejos/ copia/ ui/
public/ocr/  scripts/  supabase/{migrations,tests}/  tests/{unit,e2e,fixtures}/  docs/
```

### Estilo de código

- Dominio en español.
- Cálculos puros sin importar `ui/` ni `datos/`.
- Céntimos enteros.
- `strict` y `noUncheckedIndexedAccess`, sin `any`.

### Pruebas

Cada CA de §6 tiene su test. Cobertura ≥ 90 % en `nucleo`, `movimientos`, `comun`, `ocr/extraer`, `cartera`, `simulador` y `consejos`.

### Límites

- **Siempre:**
  - ejecutar lint, typecheck, tests y audit antes de cada commit;
  - activar RLS y crear sus tests en cada tabla nueva;
  - usar céntimos.
- **Preguntar antes:**
  - añadir dependencias;
  - cambiar la CSP, el esquema, las políticas o el workflow;
  - llamar a dominios nuevos.
- **Nunca:**
  - subir secretos o datos reales;
  - usar la *secret key* en el frontend o en CI;
  - usar `innerHTML`;
  - meter scripts inline o de terceros;
  - poner analítica;
  - subir imágenes;
  - saltarse un test que falla;
  - ejecutar operaciones financieras.

### Registro de decisiones

| Fecha | Decisión |
|---|---|
| 2026-10-01 | Arquitectura A con Supabase Free |
| 2026-10-01 | Sin cifrado en el cliente |
| 2026-10-01 | MFA opcional |
| 2026-10-01 | URL `finanzas-josecs5.github.io` y repositorio público |
| 2026-10-01 | 0 € estricto |
| 2026-10-01 | Cierre de sesión a los 30 min |
| 2026-10-01 | Inflación automática desde el INE |
| 2026-10-01 | Tú y tu pareja, con espacios Yo, Pareja y Piso |
| 2026-10-01 | Reparto 50/50 con saldo y botón «Saldar» |
| 2026-10-01 | OCR local sin guardar las imágenes |
| 2026-10-01 | La app recuerda la categoría de cada comercio |
| 2026-10-01 | Fondos actualizados a mano, con recordatorio y captura |
| 2026-10-01 | Consejos solo por reglas |
| 2026-10-01 | Estilo de app bancaria y tema según el sistema |
| 2026-10-01 | P1: los dos miembros pueden editar y borrar cualquier gasto compartido |
| 2026-10-01 | P2: liquidez apuntada a mano, con recordatorio mensual |
| 2026-10-01 | P3: reparto editable en cada gasto, con 50/50 por defecto |
