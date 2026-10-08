# Visión y alcance

> **Propósito:** qué es Señal, para quién, qué problema resuelve, qué queda fuera y cómo sabremos que funciona.
> **Relacionado:** [Glosario](02-glosario.md) · [Metodología](../01-pedagogia/02-metodologia.md) · [Roadmap](../06-desarrollo/01-roadmap.md) · [Tu plan B1→B2](../07-tu-plan/01-plan-b1-a-b2.md)

---

## En una frase

**Señal** es una web app personal (instalable como PWA) para llevarte de **B1 a C2** en inglés —con A1 y A2 cubiertos como base y como repaso— centrada en las dos destrezas que más te cuestan: **listening** y **reading**.

El nombre resume la idea: al principio el inglés hablado rápido suena a *ruido*. El trabajo de la app es convertir ese ruido en *señal*, frase a frase. (Es un nombre de trabajo; cámbialo cuando quieras con un buscar/reemplazar del slug `senal`.)

---

## Decisiones de partida

| Tema | Decisión | Consecuencia |
|---|---|---|
| Público | **Solo tú** (un usuario) | Sin registro público, sin pagos, sin panel de admin para terceros. Aun así, todas las tablas llevan `user_id` y RLS: abrirla en el futuro no obliga a rehacer la base de datos. |
| IA | **Pregenerada + corrección en vivo** | Textos, preguntas y audios se generan una vez, se revisan y se guardan. En vivo, la IA solo corrige tus writings, con límite diario y tope mensual de gasto. |
| Stack | **Next.js + Supabase**, PWA | La conoces, cabe en capas gratuitas y se instala en el móvil para escuchar en trayectos. |
| Nivel actual | **B1** (autoevaluado) | El test de nivel de la app lo confirma o lo corrige por destreza. El contenido se produce primero para B1 y B2. |
| Prioridad | Listening > Reading > Vocabulario > Writing > Speaking | Las fases del roadmap y el reparto de tiempo del plan diario siguen este orden. |

---

## El problema

1. **Las apps generalistas optimizan la racha, no la comprensión.** Sirven para empezar, pero en B1 se estancan: audio lento y limpio, textos cortos, ejercicios de reconocimiento fácil.
2. **La meseta intermedia.** En B1 entiendes material pensado para estudiantes, pero el inglés real (series, podcasts, vídeos técnicos) se te escapa. El salto a B2 exige mucho más *input* y de más calidad.
3. **En listening, la barrera principal no es el vocabulario, es la decodificación.** Un hispanohablante suele *conocer* las palabras que no entiende: no las *reconoce* cuando suenan reducidas, enlazadas y rápidas («*gonna*», «*didja*», «*turn it off*» → /tɜːnɪtɒf/). Ninguna app generalista diagnostica eso.
4. **En reading, el problema es de volumen y de precisión.** Se lee poco, se traduce todo y no se entrenan las subdestrezas (inferir, seguir referencias, entender la intención del autor).

---

## La propuesta: cinco pilares

1. **Ciclo de escucha con diagnóstico.** Escuchas → respondes → haces un microdictado de las frases clave → la app detecta *por qué* fallaste (palabra desconocida, palabra conocida no reconocida, límites de palabra, velocidad, acento) → entrenas exactamente eso. Ver [Listening](../01-pedagogia/03-listening.md).
2. **Lectura graduada con cobertura léxica controlada.** Cada texto se elige para que conozcas el 95–98 % de sus palabras, con lectura+audio sincronizado como puente entre las dos destrezas. Ver [Reading](../01-pedagogia/04-reading.md).
3. **Todo lo que no entiendes se convierte en repaso.** Palabras, expresiones y *frases de audio* pasan a un sistema de repetición espaciada (FSRS). Ver [Vocabulario y SRS](../01-pedagogia/05-vocabulario-y-srs.md).
4. **Contenido casi ilimitado y a tu medida.** Generado con IA a partir de las especificaciones del currículo, revisado automáticamente y locutado con voces neuronales de varios acentos. Ver [Pipeline de contenido](../05-contenido/01-pipeline.md).
5. **Medición honesta del nivel por destreza.** Un *rating* por destreza que se mueve con cada respuesta y pruebas de confirmación por nivel; nada de «nivel» inflado por la racha. Ver [Evaluación](../01-pedagogia/08-evaluacion-y-nivel.md).

---

## El usuario

Tú: desarrollador frontend/mobile hispanohablante, B1, con el objetivo inmediato de **B2 en comprensión** (el umbral que más pesa en ofertas de empleo) y el de seguir hacia C1/C2.

- **Contexto de uso:** móvil para escuchar (trayectos, paseos) y repasar; escritorio para leer, escribir y estudiar gramática.
- **Temas que te enganchan** (se usan para elegir contenido): espacio y astronomía, videojuegos y *modding*, producción musical, tecnología y desarrollo, viajes.
- **Estética:** interfaz oscura, limpia, de inspiración sci-fi, con acentos cian/azul eléctrico. Ver [Sistema de diseño](../03-producto/05-sistema-de-diseno.md).

---

## Alcance

### Dentro (v1)

- **Listening:** biblioteca por nivel, reproductor por frases, transcripción karaoke, ciclo de escucha con dictado diagnóstico, entrenamiento de habla conectada, registro de escucha extensiva.
- **Reading:** lector con toque para definición, preguntas de comprensión, medición de velocidad, lectura+audio, biblioteca de lectura extensiva.
- **Vocabulario:** léxico personal (palabras conocidas/en aprendizaje), glosarios contextuales, SRS con FSRS, tarjetas de audio.
- **Gramática:** fichas breves en español con contraste español–inglés, ligadas a los textos y a tus errores.
- **Writing:** tareas por nivel con corrección por IA (rúbrica de 4 criterios), con límite diario.
- **Nivel:** test inicial, *rating* por destreza, pruebas de confirmación.
- **Plan diario** («Hoy»), progreso, rachas y logros sin trampas.
- **PWA:** instalable, audio disponible sin conexión.

### Fuera (por ahora)

- Multiusuario, pagos, comunidad, rankings.
- Conversación por voz con IA en tiempo real (posible fase futura; ver [roadmap](../06-desarrollo/01-roadmap.md)).
- App nativa iOS/Android (posible fase futura; la PWA cubre v1).
- Contenido con derechos de terceros dentro de la app (sí se puede *registrar* tiempo con contenido externo).

---

## Principios de producto

1. **Comprensión antes que puntos.** Ninguna métrica de juego se gana sin comprender.
2. **i + 1.** Contenido comprensible, pero un poco por encima de tu nivel.
3. **Diagnóstico antes que repetición.** Saber *por qué* no entiendes vale más que repetir el audio diez veces.
4. **Cada fallo alimenta el repaso.** Nada de lo que te cuesta se pierde.
5. **Sesiones cortas, constancia diaria.** El plan cabe en 30–60 minutos.
6. **Métricas honestas.** Si no has mejorado, la app lo dice.
7. **Coste ≈ 0 €/mes.** Capas gratuitas y un tope de gasto en IA.
8. **La tipografía y el audio *son* la interfaz.** Es una app de leer y escuchar: legibilidad, control del audio y accesibilidad por encima de los adornos.

---

## Métricas de éxito (orientativas)

| Área | Objetivo | Cómo se mide |
|---|---|---|
| Nivel | Listening y Reading **B2 confirmados** en 9–12 meses | Pruebas de confirmación internas (+ opcionalmente un examen oficial) |
| Hábito | ≥ 5 días/semana, media ≥ 45 min/día | `activity_days` |
| Listening | Dictado ≥ 85 % de precisión en audios B2 a velocidad natural; ≥ 70 % de comprensión en la primera escucha | `item_attempts`, `listening_diagnostics` |
| Reading | ≥ 150 palabras/min en textos B2 con ≥ 75 % de comprensión | Lecturas cronometradas |
| Vocabulario | +2.000 lemas conocidos sobre tu punto de partida | `lexicon` |
| Input | 300 h acumuladas de escucha + lectura | `input_log` |

---

## Restricciones

- **Un desarrollador a tiempo parcial** (tú). El roadmap prioriza un MVP útil en 4–5 semanas.
- **Presupuesto:** Supabase Free, Vercel Hobby, Cloudflare R2 (capa gratuita), Azure AI Speech F0 y la API de Claude con tope mensual (por defecto 5 USD).
- **Sin contenido con copyright de terceros** en la app.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Construir la herramienta en lugar de estudiar | Tu plan empieza **hoy**, sin esperar a la app, con recursos externos ([plan](../07-tu-plan/01-plan-b1-a-b2.md)). La app sustituye esos recursos según va estando lista. |
| Calidad del contenido generado (sobre todo C1–C2, que aún no puedes juzgar tú) | Revisión automática con un modelo revisor distinto, métricas léxicas y de legibilidad, y comprobación de que las preguntas se responden con el texto ([control de calidad](../05-contenido/02-control-de-calidad.md)). |
| El TTS suena «demasiado limpio» comparado con el inglés real | Desde B2, mezcla con audio auténtico de dominio público y con escucha extensiva externa registrada. |
| Supabase Free pausa el proyecto tras 7 días sin actividad | Uso diario; si se pausa, se reactiva desde el panel ([despliegue](../06-desarrollo/04-entornos-y-despliegue.md)). |
| Alcance excesivo | Fases cerradas con criterios de aceptación; lo que no esté en la fase actual va a una lista «después». |
