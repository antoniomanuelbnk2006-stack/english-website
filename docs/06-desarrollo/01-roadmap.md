# Roadmap

> **Propósito:** fases cerradas, cada una con alcance, entregables y criterios de aceptación comprobables. Lo que no esté en la fase actual va a la lista «después».
> **Relacionado:** [Funcionalidades](../03-producto/01-funcionalidades.md) · [Prompts por fase](05-prompts-por-fase.md) · [Testing](03-testing-y-calidad.md)

**Ritmo supuesto:** 10–15 h/semana de desarrollo. **v1 (fases 0–7): 12–16 semanas.**

> **Importante:** no esperes a la app para estudiar. Tu [plan](../07-tu-plan/01-plan-b1-a-b2.md) empieza el día 1 con recursos externos; cada fase sustituye una parte de ellos.

---

## Vista general

| Fase | Nombre | Duración | Resultado |
|---|---|---|---|
| 0 | Cimientos | 1 sem. | Proyecto desplegado, acceso OTP, BD con RLS, CI |
| 1 | Contenido y lectura | 1–2 sem. | Lecciones de lectura usables + diario de input |
| 2 | Listening + audio mínimo | 2–3 sem. | Ciclo de escucha completo con dictado diagnóstico |
| 3 | Vocabulario, SRS y gramática | 2 sem. | **MVP**: uso diario real |
| 4 | Generación con IA + QA + Studio | 2 sem. | Primer lote de ~40 lecciones B1–B2 |
| 5 | Nivel, plan diario y progreso | 2 sem. | «Hoy» decide por ti; rating por destreza |
| 6 | Writing con IA + confirmación | 1–2 sem. | Feedback de writing; pruebas de nivel |
| 7 | PWA y sin conexión | 1 sem. | Instalable; escuchar en el metro sin cobertura |
| 8 | Expansión | Continua | *Shadowing*, clásicos, más contenido, mejoras |

---

## Estado (8 de octubre de 2026)

Las fases 0–3 están construidas y probadas en local (tests unitarios, de base de datos y e2e en escritorio y móvil). Lo que falta en cada una depende de servicios externos que aún no existen (proyecto de Supabase, claves de Azure y R2, despliegue) o se ha dejado fuera a propósito y se indica aquí. Los criterios de aceptación de más abajo no se marcan hasta comprobarlos en el entorno real.

| Fase | Hecho | Pendiente |
|---|---|---|
| 0 | Proyecto, herramientas, acceso por OTP, proxy con CSP, migraciones, shell, i18n, CI | Crear el proyecto de Supabase (UE) y aplicar las migraciones; generar `database.types.ts` (hoy es provisional); desplegar en Vercel; subir el repo a GitHub para que corra el CI |
| 1 | Modelo de contenido, validación, anotación, índice; motor de tareas; lector y ciclo de lectura; diario y registro rápido; `b1-rea-001` publicada | Tu revisión de `b1-rea-001` (la marqué como revisada por mí, pendiente de la tuya); importar el CSV del diario (opcional) |
| 2 | `content:tts`, `content:audio`, `content:upload`; reproductor con karaoke; ciclo de escucha de 8 fases; dictado diagnóstico; transcripción retenida hasta la fase 3 | **Audio real de `b1-lis-001`** (necesita las claves de Azure; el proveedor de Azure no se ha podido probar contra el servicio) y publicarla; **drills** (formas débiles, reducciones, números); **lectura + audio**; comprobar el karaoke con el Profiler |
| 3 | Léxico con estados y promoción implícita; glosario por palabra; marcar desconocidas; resaltado por estado; cobertura «para ti»; SRS con FSRS recalculado en servidor; `/repasar`, `/vocabulario`, `/gramatica`; cosecha priorizada; 5 fichas B1 | Traducción de frase bajo demanda (F-046: necesita IA, va con la fase 4); audio en los ejemplos de gramática y en las tarjetas que salen de textos sin audio; **más lecciones** (hay 2; el MVP pide unas 10); la prueba de 7 días de uso real |

**Ampliación del 9 de octubre de 2026** (a petición del dueño, [ADR-0012](../adr/0012-use-of-english-y-nivel-declarado.md)): elección de nivel A1–C2 en el primer acceso, con las bibliotecas filtradas por ese nivel; sección **Use of English** con 24 ejercicios originales en formato de examen (A1–C2); 10 lecciones más (una lectura y una escucha por nivel que faltaba); una ficha de gramática por nivel; y **Kokoro** como proveedor de voz local, con el que se ha generado el audio de todas las escuchas mientras no haya claves de Azure. El pendiente de «audio real» de la tabla queda cubierto de forma provisional: las voces son neuronales pero los tiempos por palabra son estimados.

Además, las lecciones de escucha tienen ahora dos modos, a elegir al empezar: **a ciegas** (el ciclo diagnóstico) y **con transcripción** ([ADR-0013](../adr/0013-escucha-con-transcripcion.md)).

**Writing (9 de octubre de 2026, a petición del dueño).** Se ha adelantado la parte de writing de la fase 6 (F-100 a F-106): 22 consignas de A1 a C2 con respuesta modelo; editor con contador, autoguardado local y modo examen; corrección con IA con límite diario y tope mensual; revisión sin IA ([ADR-0014](../adr/0014-writing-revision-sin-ia.md)); reescritura; errores al repaso; e historial con evolución por criterio. La corrección con IA se comprobó contra la API real con una llamada (14 s, 0,021 $; ver ADR-0014). **Pendiente de esa fase:** el conjunto dorado y `pnpm ai:eval`, que es lo que mide la calidad del prompt, y las pruebas de confirmación de nivel (F-083). Las fases 4 y 5 siguen sin empezar.

**Más lecciones (9 de octubre de 2026, a petición del dueño).** 30 lecciones nuevas, tres escuchas y dos lecturas por nivel: cada nivel de A1 a C2 tiene ahora **4 escuchas y 3 lecturas** (42 lecciones en total). Son textos originales, pasan `content:validate` y están marcadas como revisadas por Claude, pendientes de la revisión del dueño. El audio es de Kokoro, como el del resto, con tiempos por palabra estimados.

**Palabras y pronunciación (9 de octubre de 2026, a petición del dueño, [ADR-0015](../adr/0015-mazo-de-palabras-y-pronunciacion.md)).** Dos secciones nuevas, adelantadas de la fase 8: **Palabras**, el vocabulario de cada nivel (unas 8.650 palabras de A1 a C2) con traducción y ejemplo, para explorarlo, estudiarlo en tandas y mandar al repaso lo que no se sepa; y **Pronunciación**, 17 ejercicios por sonido y práctica libre, en los que el reconocimiento de voz del navegador dice si se te entiende. **Pendiente:** probar la pronunciación con un micrófono real (los tests usan un reconocedor de prueba), tu revisión de las traducciones y, si algún día hay cuenta de Azure, la evaluación por sonidos (F-112).

**Diccionario completo (10 de octubre de 2026, a petición del dueño, [ADR-0016](../adr/0016-diccionario-de-consulta-con-wiktionary.md)).** `/palabras/buscar` consulta cualquier palabra o expresión en Wiktionary en el momento, sin guardar el diccionario ni gastar dinero: traducciones al español, definiciones, pronunciación y envío al repaso. Ese mismo día se añadieron los **consejos automáticos de pronunciación** cuando una palabra no se entiende (ADR-0015).

**Simulacros de examen (10 de octubre de 2026, a petición del dueño, [ADR-0017](../adr/0017-simulacros-de-examen.md)).** Sección «Exámenes» con un simulacro por nivel: A1 (formato A2 Key), A2 Key, B1 Preliminary, B2 First, C1 Advanced y C2 Proficiency. Cada uno tiene Reading (con Use of English en B2–C2), Listening y Speaking con las partes, las preguntas y el tiempo oficial; el Writing remite a «Escribir». Dieciocho pruebas originales en `content/exams/`, con el audio del Listening generado con Kokoro. Pendiente: que el dueño revise el contenido, más simulacros por nivel, y probar el Speaking con micrófono real.

Decisiones tomadas por el camino que no estaban en el diseño original: [ADR-0011](../adr/0011-e2e-con-emulador-de-supabase.md) (tests contra un emulador de Supabase), la migración `0002` (`apply_reviews`), y los detalles anotados en [base de datos §3](../04-arquitectura/03-base-de-datos.md#3-notas-de-diseño), [gramática §2](../01-pedagogia/06-gramatica.md#2-formato-de-una-ficha) y [vocabulario §4](../01-pedagogia/05-vocabulario-y-srs.md#4-tu-léxico-personal).

---

## Fase 0 · Cimientos

**Alcance:** F-001, F-002 (básico), F-003.

**Entregables**
- Repo con Next.js 16 (TypeScript estricto, Tailwind v4, shadcn/ui, ESLint + Prettier, Vitest, Playwright).
- `docs/`, `CLAUDE.md`, `AGENTS.md` y la skill `crear-leccion` en el repo.
- Supabase local (`supabase start`) y proyecto remoto (región UE); migración `0001_base.sql`; tipos generados.
- `proxy.ts` con sesión y lista de emails; login por **código OTP**; registro desactivado.
- `src/lib/env.ts` con validación Zod.
- Shell: navegación (inferior en móvil, lateral en escritorio), tema oscuro con tokens, fuentes.
- CI en GitHub Actions; despliegue en Vercel.

**Criterios de aceptación**
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` pasan en local y en CI.
- [ ] Con tu email recibes un código, entras y ves `/hoy` (vacío). Con otro email no se puede entrar (e2e).
- [ ] Test de RLS: un segundo usuario de prueba no puede leer filas del primero (local).
- [ ] Faltar una variable de entorno obligatoria rompe el arranque con un mensaje claro.
- [ ] Producción desplegada en Vercel con las variables configuradas.

---

## Fase 1 · Contenido y lectura

**Alcance:** F-010, F-012, F-013, F-040, F-043, F-044, F-026, F-085.

**Entregables**
- `src/lib/content/schema.ts` (esquemas del [modelo de contenido](../04-arquitectura/04-modelo-de-contenido.md)), `loader.ts` y `index.ts`.
- Scripts `content:validate`, `content:annotate` (tokens, lemas, listas CEFR, cobertura) y `content:index`.
- Las 2 [lecciones de ejemplo](../05-contenido/ejemplos/README.md) en `content/` (la de lectura publicada sin audio todavía).
- Motor de tareas: `mcq`, `true_false_ng`, `gap_fill`, `short_answer`, `heading_match`, `matching`, `ordering` (corrección pura + componentes).
- `/leer` (biblioteca) y `/leer/[id]` (fases 0–3 del ciclo de lectura; cosecha como *stub*).
- `submitAttempts` + función SQL `apply_lesson_attempts` (sin Elo aún: rating fijo).
- Diario de input (`/diario`) y registro rápido desde `/hoy`.
- (Opcional) Importar el CSV del diario que hayas llevado a mano antes de tener la app ([rutina](../07-tu-plan/02-rutina-semanal.md#4-registro-mientras-no-hay-app)).

**Criterios de aceptación**
- [ ] `content:validate` detecta un ID de evidencia roto y un `answer` inexistente (tests).
- [ ] Haces `b1-rea-001` de principio a fin; se guardan intentos, nota y ppm.
- [ ] Corrección de huecos tolerante a mayúsculas, espacios y variantes aceptadas (tests).
- [ ] Registras 20 min de un podcast en ≤ 2 toques desde el móvil.

---

## Fase 2 · Listening + pipeline mínimo de audio

**Alcance:** F-011, F-020 a F-025, F-045.

**Entregables**
- Scripts `content:tts` (Azure, caché local, contador de caracteres), `content:audio` (ffmpeg, tiempos, picos) y `content:upload` (R2).
- `b1-lis-001` publicada con audio y tiempos por palabra.
- Reproductor (Zustand + `HTMLAudioElement`): segmentos, velocidad, atajos, onda, karaoke.
- Ciclo de escucha completo (fases 0–7); transcripción no enviada al cliente antes de la fase 3.
- Dictado: normalización, alineación, propuesta de causa; `listening_diagnostics`.
- Drills iniciales: formas débiles (banco de 30), reducciones, números.
- Lectura + audio en las lecciones de lectura.

**Criterios de aceptación**
- [ ] Tests del dictado con al menos 20 casos dorados (equivalencias *gonna*/*going to*, números, segmentación, palabras desconocidas).
- [ ] El karaoke no provoca re-render de la transcripción completa (verificado con React DevTools/Profiler).
- [ ] Toda la lección se completa solo con teclado; `axe` sin violaciones serias.
- [ ] La transcripción no aparece en la respuesta de red antes de completar la fase 2.
- [ ] El audio de `b1-lis-001` está entre −17 y −15 LUFS y a 133–147 ppm.

---

## Fase 3 · Vocabulario, SRS y gramática → **MVP**

**Alcance:** F-015, F-041, F-042, F-046, F-048, F-060 a F-065.

**Entregables**
- Léxico (`lexicon`), *popover* de glosario, marcado de desconocidas, cobertura por texto.
- SRS con `ts-fsrs` (recalculado en servidor), tarjetas `word`, `chunk`, `audio`, `grammar`; `/repasar` con atajos; límites diarios.
- Cosecha priorizada al terminar lecciones.
- 5 fichas de gramática B1 en MDX (las de prioridad «muy alta»).

**Criterios de aceptación**
- [ ] Tras 7 días de uso real, el SRS programa repasos coherentes (sin avalanchas; respeta 10 nuevas/día).
- [ ] Tarjeta de audio: reproduce exactamente el segmento y sugiere la valoración según el dictado.
- [ ] La biblioteca muestra «para ti: NN %» y cambia al marcar palabras.
- [ ] **Usas Señal a diario** para escucha intensiva, lectura y repaso (sustituye esa parte de los recursos externos).

---

## Fase 4 · Generación con IA, QA y Studio

**Alcance:** F-014, F-143 + producción de contenido.

**Entregables**
- `content:generate` (Batch + salida estructurada), `content:review` (dos llamadas), `content:run`, perfiles de nivel.
- `/studio` (solo desarrollo): lista con métricas, reproducción, aprobar/devolver.
- `pnpm ai:eval` para generación.
- **Primer lote:** B1 u01–u06 y B2 u01–u03 (~40 lecciones) + biblioteca extensiva inicial (2 series B1).

**Criterios de aceptación**
- [ ] Un lote de 6 lecciones se genera, revisa y publica con ≤ 15 min de tu tiempo.
- [ ] ≥ 80 % de las lecciones generadas pasan el QA a la primera.
- [ ] Coste medio por lección publicada ≤ 0,10 $ (medido con `usage`).
- [ ] TTS dentro de la capa gratuita del mes (contador).

---

## Fase 5 · Nivel, plan diario y progreso

**Alcance:** F-004, F-028, F-047, F-080 a F-082, F-084, F-120 a F-122.

**Entregables**
- Test de nivel (sí/no + adaptativos) con su banco generado.
- Elo por destreza (`lib/elo.ts`) integrado en `submitAttempts`; `rating_history`.
- Motor del plan diario (`buildDailyPlan`, puro) + `/hoy` con «por qué».
- `/progreso` (niveles, horas, palabras, «Tu oído»).
- XP, racha con comodines, misiones y logros.
- Exportar datos.

**Criterios de aceptación**
- [ ] Tests del motor del plan: los 6 casos de [Motor del plan §6](../03-producto/03-motor-del-plan-diario.md#6-tests-mínimos).
- [ ] Tests del Elo: convergencia en simulación (un «alumno» simulado de 1250 acaba en 1250 ± 60 tras 150 ítems).
- [ ] El plan del día es estable (no cambia al recargar) y se marca solo al completar actividades.

---

## Fase 6 · Writing con IA y pruebas de confirmación

**Alcance:** F-083, F-100 a F-105.

**Entregables**
- Consignas por nivel; editor; Route Handler con límites; historial; cosecha de errores.
- `pnpm ai:eval` de writing (conjunto dorado de 15 textos).
- Bancos de pruebas de confirmación B1 y B2 (Listening y Reading) y flujo de prueba.

**Criterios de aceptación**
- [ ] El límite diario y el tope mensual cortan las llamadas (tests con el SDK simulado).
- [ ] El conjunto dorado: recall ≥ 80 %, 0 correcciones en frases limpias.
- [ ] Una prueba de confirmación completa actualiza el nivel confirmado.

---

## Fase 7 · PWA y sin conexión

**Alcance:** F-027, F-140 a F-142.

**Entregables**
- Manifiesto, iconos, *service worker* (Serwist para Turbopack o manual), estrategia de caché.
- Descarga de lecciones, `/offline/[id]`, cola en IndexedDB y sincronización.
- Media Session API.

**Criterios de aceptación**
- [ ] En modo avión, una lección descargada se reproduce completa en Android y en iOS (documenta el comportamiento en segundo plano de tu iPhone).
- [ ] Intentos hechos sin red aparecen en la BD al recuperar la conexión, sin duplicados.
- [ ] Los botones de auriculares/pantalla de bloqueo saltan de frase.

---

## Fase 8 · Expansión (continua)

Por orden de valor para ti:
1. Más contenido B2 (u07–u12) y biblioteca extensiva B2.
2. *Shadowing* con grabación local (F-029).
3. Optimizador de FSRS con tu historial (F-066).
4. Paquetes de refuerzo A1–A2 según lo que detecte el test.
5. C1 (cuando confirmes B2).
6. Clásicos de dominio público con audio alineado (F-016).
7. Recordatorio diario por notificación (F-123).
8. Importar audio propio (F-030).
9. Speaking con transcripción y evaluación de pronunciación.
10. (Valorar) app nativa si la PWA no cubre bien la escucha en segundo plano.

---

## Definición de «hecho» (todas las fases)

- Tipos sin errores, sin `any`; lint limpio.
- Tests de la lógica pura nueva; e2e del flujo principal tocado.
- Accesible por teclado; sin violaciones serias de `axe`.
- Probado en móvil (al menos en el simulador de Chrome + tu teléfono al cerrar la fase).
- Documentación actualizada (y un ADR si se tomó una decisión de arquitectura).
- Sin errores en consola.
