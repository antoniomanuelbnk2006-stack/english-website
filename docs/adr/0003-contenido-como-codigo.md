# ADR-0003 · El contenido vive como JSON versionado en el repo

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto
Las lecciones son ricas (texto, tareas, glosario, tokens, tiempos) y cambian poco. Solo las crea y revisa una persona, con un pipeline local. Hace falta revisar cambios, volver atrás y validar todo antes de publicar.

## Decisión
Las lecciones, fichas, drills y bancos de pruebas se guardan como **JSON/MDX en `content/`**, validados con Zod en CI. La base de datos solo guarda lo que haces tú; las lecciones se referencian por `lesson_id` + `lesson_version`. Un índice generado (`index.generated.json`) sirve para listados y para el plan diario.

## Alternativas consideradas
- **Contenido en tablas de Postgres:** consultas flexibles, pero sin *diffs* legibles, más espacio en la capa gratuita y un panel de edición que construir.
- **CMS headless:** otra cuenta, otro servicio y un modelo de datos que no encaja bien con tokens y tiempos por palabra.

## Consecuencias
- ✅ Historial y revisión con git; *rollback* trivial; validación en CI; coste de BD cero.
- ✅ Encaja con Claude Code: el contenido es código que se puede generar, validar y revisar.
- ⚠️ Publicar contenido = *commit* + despliegue (aceptable para un único autor).
- ⚠️ Hay que incluir `content/**` en el *bundle* de las funciones de Vercel (`outputFileTracingIncludes`).
- ⚠️ Si el repo crece mucho por los JSON, se pueden mover a un paquete o a R2 sin cambiar el contrato.
