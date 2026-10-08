# Writing y speaking

> **Propósito:** cómo se practica la producción en una app centrada en comprensión, y por qué no se abandona.
> **Relacionado:** [IA](../04-arquitectura/06-ia.md) · [Roadmap](../06-desarrollo/01-roadmap.md) · [Errores típicos](09-errores-hispanohablantes.md)

---

## 1. Por qué producir si el objetivo es entender

- **Producir te obliga a notar lo que no sabes** (hipótesis del *output*, Swain): al escribir descubres el hueco, y luego lo ves en los textos.
- **Pronunciar mejora la percepción**: lo que sabes articular, lo reconoces mejor al oírlo (base del *shadowing*).
- B2 «de verdad» incluye escribir y hablar; aunque ahora prioricemos comprensión, no conviene llegar a B2 receptivo con un B1 productivo oxidado.

Por eso Señal reserva ~15 % del tiempo a producción (ver [metodología §3](02-metodologia.md#3-reparto-de-tiempo-recomendado-para-ti-b1-receptivo)).

---

## 2. Writing

### 2.1 Tareas por nivel

| Nivel | Tipos de texto | Longitud |
|---|---|---|
| A1 | Mensajes, formularios, postales | 25–50 palabras |
| A2 | Correos informales, notas, descripciones cortas | 35–80 |
| B1 | Correos (informal/semiformal), relatos cortos, artículos sencillos | 100–150 |
| B2 | Ensayo argumentativo, reseña, artículo, informe, correo formal | 140–250 |
| C1 | Ensayo, propuesta, informe, carta formal, reseña crítica | 220–320 |
| C2 | Ensayo de opinión con fuentes, artículo, reseña, informe complejo | 280–400 |

Las consignas se generan por nivel y tema y viven en `content/writing/{nivel}/*.json`.

### 2.2 Flujo

1. **Consigna** (con destinatario, propósito y puntos a cubrir).
2. **Plan** opcional (3 viñetas).
3. **Escribir** con contador de palabras y temporizador opcional (modo examen).
4. **Feedback de IA** (llamada en vivo, con límite diario; ver [IA](../04-arquitectura/06-ia.md)).
5. **Reescritura**: corriges tú, con el feedback al lado.
6. **Cosecha**: los errores recurrentes van al SRS (`grammar`/`chunk`).
7. **Historial**: evolución de las puntuaciones por criterio.

### 2.3 Rúbrica

Cuatro criterios puntuados de 0 a 5, inspirados en los que usan los exámenes de Cambridge para el writing:

| Criterio | Qué mira |
|---|---|
| **Contenido** | ¿Cubre lo pedido? ¿Está informado el lector? |
| **Logro comunicativo** | ¿Registro y formato adecuados al tipo de texto y al lector? |
| **Organización** | Párrafos, conectores, coherencia, progresión |
| **Lengua** | Variedad y precisión de gramática y vocabulario |

Además, un **nivel estimado** del texto (A1–C2) y una lista priorizada de correcciones.

### 2.4 Reglas para el feedback (van en el prompt del sistema)

1. **Prioriza**: 3–6 correcciones importantes, no 25. Primero lo que impide entender, luego lo recurrente, luego lo estético.
2. **Explica en español**, breve, con la regla en una línea.
3. **Respeta tu voz**: la versión corregida cambia lo mínimo; la «versión mejorada» es aparte y opcional.
4. **Sube un nivel**: 2–4 sugerencias concretas para sonar al nivel siguiente (*good* → *rewarding*, frase simple → relativa…).
5. **Nunca inventes errores**. Si algo es correcto pero mejorable, va a sugerencias, no a correcciones.
6. **Un foco**: termina con *una* cosa a practicar la semana siguiente.

### 2.5 Cadencia

2 writings por semana (≈ 15 min cada uno). Al acercarte a una prueba de confirmación, 1 en modo examen (tiempo limitado, sin ayudas).

---

## 3. Speaking (fase posterior)

En la v1 el speaking se limita a lo que **ayuda al listening** y no cuesta dinero:

### 3.1 *Shadowing* (v1)
- Eliges un segmento de una lección ya trabajada.
- Lo escuchas, **lo grabas a la vez o justo después** (MediaRecorder, en local), y comparas A/B: original ↔ tú.
- Opciones: velocidad reducida, solo una frase, repetir en bucle.
- No se sube a ningún servidor: la grabación vive en el navegador (IndexedDB) y se borra a los 7 días.

### 3.2 Lectura en voz alta (v1)
- Lees un párrafo de un texto ya trabajado; la app te deja escucharte junto al audio de referencia.

### 3.3 Respuesta oral con feedback (fase 8+)
- Respondes oralmente a una pregunta; la transcripción se obtiene con la Web Speech API del navegador o con Azure Speech (capa gratuita con horas limitadas) y pasa por el mismo flujo de feedback que el writing (adaptado al habla).
- **Evaluación de pronunciación** opcional con Azure (precisión, fluidez, completitud por palabra), dentro de la capa gratuita.

### 3.4 Conversación por voz con IA (futuro, fuera de la v1)
Coste y complejidad altos; se reevaluará cuando el resto esté consolidado.

---

## 4. Requisitos funcionales derivados

| ID | Requisito |
|---|---|
| FR-W-01 | Biblioteca de consignas por nivel y tipo de texto. |
| FR-W-02 | Editor con contador de palabras, autoguardado local y modo examen. |
| FR-W-03 | Feedback IA con esquema estructurado (§2.3–2.4), límite diario y tope mensual. |
| FR-W-04 | Vista de reescritura con feedback lateral. |
| FR-W-05 | Historial con evolución por criterio. |
| FR-S-01 | *Shadowing* con grabación local y comparación A/B. |
| FR-S-02 | Las grabaciones no salen del dispositivo y caducan a los 7 días. |
