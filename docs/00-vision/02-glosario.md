# Glosario

> **Propósito:** vocabulario común para que la documentación, el código y tus prompts a Claude usen los mismos términos.
> Los identificadores de código (columnas, tipos, enums) van entre `comillas de código`.

---

## Pedagogía

| Término | Definición |
|---|---|
| **MCER / CEFR** | Marco Común Europeo de Referencia para las Lenguas. Seis niveles: A1, A2 (usuario básico), B1, B2 (independiente), C1, C2 (competente). En código: `cefr` con valores `A1`…`C2`. |
| **Niveles «plus»** | Subniveles A2+, B1+, B2+ del Volumen complementario del MCER (2020). En Señal se representan como la mitad alta de cada banda de *rating*. |
| **Descriptor «puedo» (can-do)** | Afirmación de lo que alguien es capaz de hacer en un nivel. En Señal tienen ID: `L-B1-03` (Listening), `R-B2-05` (Reading), `W-…`, `S-…`. |
| **Input comprensible** | Lengua que entiendes casi del todo gracias al contexto. Base de la adquisición receptiva. |
| **i + 1** | Input un poco por encima de tu nivel actual: lo bastante fácil para entenderlo, lo bastante difícil para aprender. |
| **Cobertura léxica** | % de palabras (tokens) de un texto que ya conoces. Objetivo: 98 % para lectura/escucha extensiva, 95 % para intensiva. `coverage`. |
| **Lema** | Forma de diccionario de una palabra (*running, ran, runs* → *run*). Unidad de conteo de vocabulario en Señal. `lemma`. |
| **Familia de palabras** | Lema + derivados (*happy, unhappy, happiness*). Se usa en la bibliografía; Señal cuenta lemas. |
| **Decodificación** | Pasar del sonido (o de la grafía) a palabras reconocidas. En listening es el cuello de botella típico de B1. |
| **Construcción de significado** | Pasar de palabras reconocidas a ideas: contexto, inferencia, intención. |
| **Habla conectada** | Cambios que sufren las palabras al encadenarse en el habla natural: formas débiles, enlace, elisión, asimilación, *flap*, golpe de glotis, reducciones (*gonna*). `connected_speech`. |
| **Forma débil** | Pronunciación átona y reducida de una palabra gramatical: *to* → /tə/, *can* → /kən/, *of* → /əv/. |
| **Schwa** | Vocal neutra /ə/, la más frecuente del inglés; aparece en casi todas las sílabas átonas. |
| **Dictado diagnóstico** | Escribir lo que oyes de una frase clave para localizar exactamente qué palabras no reconoces. |
| **Causa de fallo** | Por qué no entendiste un fragmento: `unknown_word`, `not_recognized`, `boundaries`, `speed`, `accent`, `attention`. |
| **Escucha/lectura intensiva** | Trabajo detallado sobre un texto corto, con tareas y análisis. |
| **Escucha/lectura extensiva** | Mucho volumen de material fácil, por placer y sin tareas. |
| **Escucha estrecha (*narrow listening*)** | Muchos audios cortos sobre el mismo tema: el vocabulario se repite y se consolida. |
| ***Shadowing*** | Repetir en voz alta lo que oyes, casi a la vez que el hablante. Entrena percepción y ritmo. |
| ***Skimming* / *scanning*** | Lectura rápida para la idea general / para encontrar un dato concreto. |
| **ppm (wpm)** | Palabras por minuto. Velocidad del habla en listening, velocidad lectora en reading. |
| **SRS** | Sistema de repetición espaciada: repasos programados justo antes de que olvides algo. |
| **FSRS** | *Free Spaced Repetition Scheduler*: algoritmo de SRS de código abierto (versión actual FSRS-6, librería `ts-fsrs`). |
| **Retención deseada** | Probabilidad objetivo de recordar una tarjeta cuando toca repasarla. Por defecto 0,90. |
| **Minería de frases** | Guardar frases reales de lo que lees/escuchas como tarjetas, en vez de palabras sueltas. |

## Medición

| Término | Definición |
|---|---|
| **Rating** | Número tipo Elo que estima tu nivel en una destreza (`skill_ratings.rating`). Escala: A1 600–799 … C2 1600+. |
| **Dificultad de ítem** | Número en la misma escala que estima lo difícil que es una pregunta (`item_difficulty`). |
| **Banda** | Tramo de 200 puntos de rating que corresponde a un nivel MCER. |
| **Prueba de confirmación** | Mini-examen que confirma el paso de nivel en una destreza. Solo se desbloquea cuando el rating lo sugiere. |
| **Test de nivel (*placement*)** | Prueba inicial adaptativa (~25–30 min) que fija los ratings y siembra tu léxico. |

## Técnica

| Término | Definición |
|---|---|
| **Lección** | Unidad de contenido intensivo (un audio o un texto con sus tareas). ID: `b1-lis-001`, `b2-rea-014`. |
| **Ítem / tarea** | Cada pregunta o ejercicio dentro de una lección. ID: `b1-lis-001:q3`. |
| **Borrador (`LessonDraft`)** | Lección tal como la escribe una persona o la IA: texto, tareas, glosario. Sin anotaciones ni audio. |
| **Lección publicada (`Lesson`)** | Borrador + anotaciones lingüísticas (lemas, POS), audio con tiempos por palabra, informe de calidad y dificultad calculada. |
| **Segmento** | Frase de un audio con hablante y tiempos de inicio/fin. Unidad del reproductor. |
| **Contenido como código** | Las lecciones viven como JSON versionado en el repo (`content/`), no en la base de datos. |
| **TTS** | Texto a voz. Proveedor por defecto: Azure AI Speech (voces neuronales). |
| **SSML** | Lenguaje de marcado para controlar voz, velocidad, pausas y énfasis en TTS. |
| ***Word boundary*** | Evento del TTS que indica el instante exacto en que empieza cada palabra. Permite el karaoke sin alineado forzado. |
| **Alineado forzado** | Calcular los tiempos de cada palabra de un audio a partir de su transcripción (para audio que no viene del TTS). |
| **RLS** | *Row Level Security* de Postgres: cada fila solo es visible para su `user_id`. |
| **PWA** | Web app instalable con *service worker*, manifiesto y funcionamiento sin conexión. |
| **ADR** | *Architecture Decision Record*: documento corto que registra una decisión técnica, sus alternativas y sus consecuencias. Ver [adr/](../adr/README.md). |
| **Batch API** | Modo asíncrono de la API de Claude para procesar muchas peticiones con un 50 % de descuento. |
| **Salidas estructuradas** | Modo de la API de Claude que garantiza JSON válido según un esquema (`output_config.format`). |
| **Studio** | Ruta interna, solo en desarrollo, para revisar y aprobar lecciones generadas. |
