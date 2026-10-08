# ADR-0004 · Audio en Cloudflare R2 con URLs versionadas e inmutables

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto
Cientos de ficheros de audio que se reproducen muchas veces (repeticiones, tarjetas, dictados) y se descargan para uso sin conexión. El coste de **salida de datos** es el que suele crecer.

## Decisión
**Cloudflare R2** con lectura pública (dominio propio o `r2.dev`), rutas versionadas `audio/{nivel}/{id}/v{n}.m4a` y `Cache-Control: public, max-age=31536000, immutable`. Escritura solo desde el pipeline local con un token limitado al *bucket*. CORS restringido al origen de la app.

## Alternativas consideradas
- **Supabase Storage:** integrado, pero 1 GB y salida limitada en Free.
- **Ficheros en `public/` del repo:** el repo crecería con binarios y cada cambio redesplegaría todo.
- **S3:** fiable, pero la salida se paga.

## Consecuencias
- ✅ 10 GB gratis y **salida sin coste**; caché del navegador y del SW máxima gracias a la inmutabilidad.
- ✅ Las funciones de audio extra (tarjetas, palabra en contexto, dictado) reutilizan el mismo fichero por tiempos.
- ⚠️ Una cuenta más que gestionar; sin dominio propio, `r2.dev` tiene límites (suficientes para uso personal).
- ⚠️ Cambiar un audio exige nueva versión (nunca sobrescribir).
