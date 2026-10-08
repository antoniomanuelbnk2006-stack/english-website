# ADR-0005 · Azure AI Speech como TTS, tras una interfaz intercambiable

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto
El listening es la prioridad. Hace falta audio natural, **muchos acentos de inglés**, control de velocidad y, sobre todo, **tiempos por palabra** para el karaoke, el dictado y las tarjetas de audio. Presupuesto ≈ 0 €.

## Decisión
**Azure AI Speech** (voces neuronales, plan F0 con 0,5 M caracteres/mes) usado **solo en el pipeline local**, con SSML por segmento y eventos *word boundary* para los tiempos. Todo detrás de una interfaz `TtsProvider` para poder cambiar de proveedor. Alternativa local configurada: **Kokoro** (Apache 2.0), con alineado forzado si no da tiempos.

## Alternativas consideradas
- **ElevenLabs:** calidad excelente y tiempos por carácter, pero la capa gratuita es pequeña para cientos de lecciones.
- **OpenAI TTS:** buena calidad, menos variedad de acentos y sin tiempos por palabra nativos.
- **Google Cloud TTS:** opción equivalente; Azure se elige por su catálogo de variantes de inglés y los eventos de palabra.
- **Web Speech API del navegador:** gratis, pero calidad y voces dependen del dispositivo; solo como complemento para palabras sueltas.
- **Solo open source (Kokoro, etc.):** coste cero ilimitado, pero menos acentos.

## Consecuencias
- ✅ Acentos de EE. UU., Reino Unido, Australia, Irlanda, Canadá, India, Nueva Zelanda, Sudáfrica, Nigeria…
- ✅ Tiempos por palabra sin alineado forzado; caché local por *hash* → no se paga dos veces el mismo audio.
- ⚠️ La capa gratuita limita a ~150–250 piezas de audio al mes: el pipeline cuenta caracteres y avisa.
- ⚠️ El TTS suena más limpio que el habla real: desde B2 se complementa con audio auténtico ([B2](../02-curriculo/B2.md#3-especificación-de-audio)).
- ⚠️ Los nombres de voces cambian con el tiempo: la tabla de voces vive en un único fichero de configuración.
