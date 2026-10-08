# Lecciones de ejemplo

Dos lecciones B1 completas en formato borrador, escritas siguiendo el currículo, los prompts y el modelo de contenido. Tres usos:

1. **Plantilla** para escribir o generar más lecciones.
2. **Datos de prueba** (*fixtures*) para los tests del motor de tareas, el dictado y el reproductor.
3. **Primeras lecciones reales** de la app en cuanto tengas el pipeline mínimo de audio (fase 2).

| ID | Título | Destreza | Unidad | Lo que entrena |
|---|---|---|---|---|
| [`b1-lis-001`](b1-lis-001.md) | *Watching the Orionids* | Escucha (diálogo, en-GB + en-US) | `b1-u02` Cielo nocturno | Números (*forty/fourteen*), horas británicas (*half eleven*), formas débiles, *gonna*, *flap* americano, inferencia |
| [`b1-rea-001`](b1-rea-001.md) | *The Second Life of Old Games* | Lectura (artículo) | `b1-u03` Videojuegos y comunidades | Idea general, referencias, vocabulario en contexto, actitud, propósito, conectores, relativas sin *that* |

Para usarlas, copia el bloque JSON de cada documento a `content/lessons/b1/{listening|reading}/{id}.json` y sigue el [pipeline](../01-pipeline.md#6-modo-manual-fases-13-del-roadmap).

Los JSON de estos documentos se han comprobado contra los esquemas Zod de [Modelo de contenido](../../04-arquitectura/04-modelo-de-contenido.md) y contra las invariantes de referencias (IDs, evidencias, frases del glosario y de habla conectada).
