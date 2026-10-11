# Plan de mejoras: lo imprescindible, el test de nivel y la revisión de writing

> **Propósito:** reunir en un solo sitio qué hacer a continuación en Señal, por orden de importancia y **sin gastar dinero**. Recoge tres bloques: (1) lo imprescindible, (2) un test de nivel que diga qué practicar, y (3) cómo hacer más fiable la revisión de writing sin IA.
> **Estado:** propuesta del 11 de octubre de 2026, pedida por el dueño. Nada de esto está construido todavía; cada punto dice qué existe ya y qué falta.
> **Relacionado:** [Roadmap](01-roadmap.md) · [Evaluación y nivel](../01-pedagogia/08-evaluacion-y-nivel.md) · [ADR-0014 · Writing sin IA](../adr/0014-writing-revision-sin-ia.md) · [Funcionalidades](../03-producto/01-funcionalidades.md)

---

## 0. Reglas del plan

1. **Coste cero.** Todo lo de este documento es código propio o servicios con plan gratuito. Lo que costaría dinero está en la [§6](#6-lo-que-queda-fuera-a-propósito).
2. **Honestidad sobre lo que mide cada cosa.** Un test corto da una estimación, no un certificado; una revisión sin IA no ve el significado. Cada apartado dice sus límites.
3. **Antes de construir, un ADR.** Cada bloque de abajo cambia una decisión o añade una pieza grande: va con su ADR, como el resto del proyecto.

---

## 1. Lo imprescindible (por orden)

| # | Qué | Por qué | Coste | Esfuerzo | Ya existe |
|---|---|---|---|---|---|
| 1 | **App instalable (PWA)** — F-140 | Cambia el uso diario: icono en el móvil, abre a pantalla completa. | 0 € | Bajo | No |
| 2 | **Test de nivel + qué practicar** — F-080/081 (§2) | Hoy el nivel lo eliges tú. Medido por destreza, dice dónde estás y qué te cuesta más. | 0 € | Alto | Solo el diseño |
| 3 | **Cuestionarios por nivel** (landing → «Explorar A1…C2») | Da sentido al botón de la presentación: una prueba corta de ese nivel con resultado. | 0 € | Medio | Use of English por nivel |
| 4 | **Plan diario inteligente en «Hoy»** — F-082 | Que la web diga qué hacer según tus fallos, en vez de «elige tú». Depende del punto 2. | 0 € | Medio | «Hoy» con plan manual |
| 5 | **Revisión de writing más fiable** (§3) | Es lo único de writing que funciona sin clave de IA. | 0 € | Medio | 94 reglas + comprobaciones |
| 6 | **Exportar tus datos** — F-004 | Una copia de tu progreso por si Supabase falla o se pausa. | 0 € | Bajo | No |
| 7 | **Más contenido** (lecciones, Use of English, simulacros) | Con 4 escuchas y 3 lecturas por nivel hay poco recorrido. | 0 € | Continuo | 42 lecciones, 18 pruebas |

**Orden recomendado:** 1 → 2 → 3 → 4 → 5 → 6, con el 7 en paralelo. El 1 es corto y se nota enseguida; el 2 es lo que más valor da y desbloquea el 3 y el 4.

### 1.1 Mantenerlo gratis

- **Supabase Free** pausa el proyecto tras 7 días sin actividad (los datos no se pierden; se reactiva desde el panel). Entrar una vez por semana lo evita.
- **Vercel Hobby** es para uso personal y no comercial.
- **La corrección con IA** es lo único que gasta: tiene tope de 10 al día y 5 $ al mes. Sin clave, queda la revisión sin IA (gratis).
- Quedarse con la dirección `.vercel.app` y el código fijo evita dominio y correo propios.

---

## 2. Test de nivel: qué eres y qué practicar

### 2.1 Qué debe contestar

Dos preguntas, no una:

1. **¿En qué nivel estás?** (A1–C2, por destreza).
2. **¿Qué te cuesta más?** — la destreza o el sonido/estructura donde fallas, para proponerte qué practicar.

### 2.2 Diseño (30 min, ya definido en pedagogía)

El detalle está en [Evaluación y nivel §2](../01-pedagogia/08-evaluacion-y-nivel.md#2-test-de-nivel-30-min). Resumen:

| Parte | Duración | Qué mide | Mecanismo |
|---|---|---|---|
| Vocabulario sí/no | 5 min | Tamaño de vocabulario estimado | 60 palabras reales + 20 inventadas; corrige por adivinación |
| Listening adaptativo | 8–10 min | Comprensión oral | 12 ítems, dificultad que se ajusta a tus aciertos (Elo, K = 64) |
| Reading adaptativo | 10 min | Comprensión lectora | 8 ítems, mismo mecanismo |
| Gramática y uso | 5 min | Estructuras | 16 ítems cortos, mismo mecanismo |

Se guarda en `placement_results` y siembra tu léxico (las bandas con ≥ 90 % de aciertos pasan a «conocidas»).

### 2.3 Qué practicar: la regla

El resultado enseña, por destreza, **nivel y rating**. El plan se deriva así:

```
1. Calcula el nivel de cada destreza (listening, reading, vocabulario, gramática).
2. La destreza con el rating más bajo es tu punto débil → ocupa la mayor parte del plan.
3. Si la diferencia con la siguiente es < 100 puntos, se reparte a partes iguales (no hay un punto débil claro).
4. Dentro de la destreza débil, se priorizan las causas de fallo más frecuentes:
   - listening: habla conectada, velocidad, vocabulario, acento;
   - reading: vocabulario no conocido, inferencia, detalle;
   - gramática: las fichas de las reglas falladas.
5. Se propone: «Esta semana: 3 escuchas de nivel X, 2 fichas de Y y el repaso diario».
```

Ejemplo de salida para el usuario:

> **Tu nivel estimado: B1 alto.** Reading B2 · Gramática B1 · Listening B1 bajo.
> **Lo que más te cuesta: listening.** Fallas sobre todo en habla conectada.
> **Esta semana:** 3 escuchas de B1 a ciegas, 2 drills de habla conectada y el repaso diario.

### 2.4 Límites (que la pantalla debe decir)

- Es una **estimación**: 30 minutos no sustituyen a un examen oficial.
- No mide **writing ni speaking**; para eso están Escribir y los simulacros.
- Con pocos ítems por destreza, el resultado tiene margen de error: se repite cada 3 meses (opcional) y se afina con el uso diario (rating Elo).

### 2.5 Versión corta para la landing («Explorar A1…C2»)

Mientras el test completo no exista, cada botón puede abrir un **cuestionario de ~10 preguntas de ese nivel** (Use of English filtrado por nivel, que es lo que hace hoy). Cuando exista el test, «Explorar» podría empezar el test centrado en ese nivel.

### 2.6 Qué hay que construir

| Pieza | Dónde | Notas |
|---|---|---|
| Ítems del test | `content/placement/` | **No se reutilizan en lecciones.** Con respuestas solo en servidor. |
| Selección adaptativa | `src/features/level/lib/` | Ya hay `bands.ts` e `item-difficulty.ts` (Elo). |
| Pantalla del test y del resultado | `src/app/(app)/nivel/` | Guardado parcial y reanudación. |
| Tabla `placement_results` | migración nueva | Con `user_id`, RLS y política en la misma migración. |
| Plan «qué practicar» | `src/features/level/lib/` | Función pura con tests (la regla de §2.3). |

---

## 3. Revisión de writing sin IA más fiable

### 3.1 Qué hace hoy

La [revisión sin IA](../adr/0014-writing-revision-sin-ia.md) devuelve: comprobaciones de forma (longitud, párrafos, conectores, palabras repetidas, frases largas), **94 reglas** de errores típicos de hispanohablantes, la respuesta modelo y una autoevaluación de 0 a 5 por criterio. Su principio es **callar antes que marcar algo correcto**.

### 3.2 Qué no puede ver

El significado, la coherencia, si responde a la consigna y el estilo o el registro. Eso solo lo hace una persona o la IA; ninguna mejora de abajo lo arregla.

### 3.3 Mejoras, por impacto

| # | Mejora | Qué arregla | Coste | Riesgo |
|---|---|---|---|---|
| A | **Más reglas de errores reales**: preposiciones, artículos, orden de palabras (*always I go*), falsos amigos (*actually*, *assist*, *realize*), tiempos verbales | La cobertura: un B2 comete más errores de los que hoy se detectan | 0 € | Falsos positivos; cada regla lleva ejemplos buenos y malos |
| B | **LanguageTool** (corrector gramatical de código abierto) | Miles de reglas de gramática y estilo | 0 € (API pública con límite, o local con Java) | **Privacidad:** la API pública recibe tus textos. Hay que decidirlo antes (ver §3.4) |
| C | **Ortografía con diccionario (Hunspell)** | Palabras mal escritas, con sugerencia | 0 € | Bajo; nombres propios y términos técnicos dan avisos de más |
| D | **Nivel de confianza por aviso** («seguro» / «posible») | Que mires primero lo que de verdad es un error | 0 € | Bajo |
| E | **Descriptores de Cambridge** en la autoevaluación, con ejemplos de un 2, un 3 y un 5 para tu nivel | Una nota menos subjetiva | 0 € | Bajo |
| F | **Medidas objetivas del texto**: variedad de palabras, longitud media de frase, proporción de vocabulario de tu nivel o superior | Una idea clara de si el texto está al nivel | 0 € | Son indicios, no una nota |
| G | **Comparar con la respuesta modelo**: vocabulario, estructuras y conectores compartidos | Una referencia concreta, no genérica | 0 € | Bajo |

**Orden recomendado:** A (continuo) → C → D → E → F → B (solo tras decidir la privacidad).

### 3.4 Antes de usar LanguageTool

Es lo que más cobertura da, pero hay una decisión pendiente:

- **API pública gratuita:** cómoda, con límite de peticiones, y **envía tus textos a un servidor ajeno**. Para un texto de práctica quizá no importe; hay que decidirlo conscientemente.
- **Servidor propio (Java):** el texto no sale de tu ordenador, pero **no funciona desde Vercel**, solo en local.
- **Opción segura:** usarlo solo como complemento opcional, con un aviso («este texto se enviará a un servicio externo»), y nunca por defecto.

### 3.5 Cómo mantener la fiabilidad con el tiempo

1. Cuando una pista te parezca equivocada, **anota el texto**; ese caso entra como ejemplo «bueno» de la regla.
2. Todo el inglés publicado del repositorio se pasa por las reglas en los tests: si una regla marca algo correcto, falla el test.
3. Cada regla nueva lleva sus ejemplos buenos y malos y se prueba antes de publicarse.

### 3.6 La alternativa sin código

Pegar tu texto en una conversación con Claude Code da la corrección de más calidad (significado, coherencia, registro) y **no gasta la clave de la API**, porque cuenta como uso de la herramienta. Es manual, pero es lo más fiable que hay hoy.

---

## 4. Orden de trabajo propuesto

| Fase | Contenido | Resultado visible |
|---|---|---|
| 1 | PWA instalable (§1, punto 1) y exportar datos (punto 6) | Icono en el móvil y copia de tu progreso |
| 2 | Test de nivel y «qué practicar» (§2) | Un nivel medido y un plan |
| 3 | Cuestionarios por nivel + plan diario en «Hoy» (§1, puntos 3 y 4) | «Explorar A1…C2» lleva a una prueba; «Hoy» propone qué hacer |
| 4 | Revisión de writing: reglas, ortografía, confianza y descriptores (§3, A, C, D, E, F) | Revisión más precisa y una nota menos subjetiva |
| 5 | Decidir LanguageTool (§3, B) | Más cobertura de gramática, si se acepta el compromiso |
| continuo | Más contenido | Más lecciones y simulacros |

---

## 5. Cómo saber que ha funcionado

| Cambio | Señal de éxito |
|---|---|
| PWA | Se instala desde el navegador y abre sin barra de direcciones. |
| Test de nivel | Da un nivel por destreza y un plan; repetirlo con el mismo perfil da resultados parecidos (±1 banda). |
| Cuestionarios | Cada «Explorar» abre una prueba de ese nivel y guarda el resultado. |
| Revisión de writing | Sobre tus textos reales: menos avisos equivocados y más errores reales detectados que antes. |

---

## 6. Lo que queda fuera a propósito

Cosas que **cuestan dinero** o dependen de servicios de pago; se descartan mientras el objetivo sea coste cero:

| Qué | Por qué se deja |
|---|---|
| Dominio propio (~12 €/año) | `english-website-omega.vercel.app` funciona; basta con un nombre `.vercel.app` más corto. |
| SMTP propio | El código fijo ya evita el correo. |
| Azure (voz y evaluación de pronunciación) | Capa gratuita limitada; hoy sirven Kokoro y el reconocimiento del navegador. |
| Corrección con IA de pago intensiva | Tiene tope de 10 al día y 5 $ al mes; la revisión sin IA es el camino sin coste. |
| Recordatorios push, audio sin conexión, logros | Agradables, pero no cambian lo esencial. |
