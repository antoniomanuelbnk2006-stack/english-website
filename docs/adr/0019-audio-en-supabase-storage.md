# ADR-0019 · El audio, en el Storage del proyecto de Supabase

- **Estado:** Aceptada (convive con [ADR-0004](0004-audio-en-r2.md): R2 sigue soportado)
- **Fecha:** 2026-10-10

## Contexto

El diseño preveía servir el audio desde Cloudflare R2 ([ADR-0004](0004-audio-en-r2.md)). Hasta el primer despliegue (10 de octubre de 2026) el audio solo existía en el equipo del dueño (`public/dev-audio/`, fuera de git), así que en la web desplegada los listening no sonaban. El dueño pidió que funcionara ya.

R2 obliga a abrir otra cuenta, dar un método de pago y configurar un bucket, un dominio o subdominio público, CORS y un token. El proyecto ya tiene un proyecto de Supabase con Storage incluido, y el audio ocupa 46 MB (88 ficheros).

## Decisión

**El audio se sube a un bucket público del Storage de Supabase** (`senal-audio`), con las mismas rutas que en R2 (`audio/b1/b1-lis-001/v1.m4a`, `audio/exams/b2/…/r01.m4a`).

- `pnpm content:upload --ids <ids> --supabase` lo sube con la API de Storage y la clave *secret* del proyecto, que vive solo en `.env.pipeline` (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_AUDIO_BUCKET`). La app no la usa nunca. El comando crea el bucket si no existe.
- Sin opción, `content:upload` sigue subiendo a R2, y con `--local` copia a `public/dev-audio/`. Los tres destinos comparten las mismas reglas: una ruta ya subida con otro contenido es un error (hay que subir `version`), y repetir la subida no hace nada.
- La app no cambia: `NEXT_PUBLIC_AUDIO_BASE_URL` apunta a `https://<ref>.supabase.co/storage/v1/object/public/senal-audio` y la CSP ya admite el origen que diga esa variable.
- Storage sirve los ficheros con `Content-Type: audio/mp4`, `Accept-Ranges: bytes` (el reproductor salta por frases), `Access-Control-Allow-Origin: *` y `Cache-Control: public, max-age=31536000`.

## Alternativas consideradas

- **R2, como estaba previsto.** Mejor a largo plazo (sin coste de salida, dominio propio), pero más pasos y otra cuenta para un problema que hoy son 46 MB. Pasarse después es subir los mismos ficheros con `content:upload` y cambiar una variable.
- **Meter el audio en el repositorio** para que Vercel lo sirva desde `public/`. Lo prohíbe el proyecto (nunca se *commitea* audio): infla el repositorio para siempre y cada despliegue lo arrastraría.
- **Vercel Blob.** Otro servicio que configurar, con una capa gratuita más pequeña.

## Consecuencias

- **Límites del plan Free de Supabase:** 1 GB de ficheros y 5 GB de salida al mes. Sobra para un usuario; habría que mirarlo si el contenido creciera mucho (cada nivel completo son unos 8 MB).
- **Si el proyecto se pausa por inactividad** (siete días sin uso en el plan Free), se quedan sin servicio la base de datos y también el audio, hasta reactivarlo desde el panel.
- El bucket es **público**: cualquiera con la URL puede oír un audio. Es contenido original y no hay nada privado en él; las transcripciones no se sirven desde ahí.
- Storage no deja marcar los objetos como `immutable`, pero la regla del proyecto (un audio nuevo es una versión nueva, con otra ruta) hace que la caché de un año sea igual de segura.
- `content:validate` (sin `--offline`) comprueba que cada audio publicado responde en la URL configurada, sea cual sea el destino.
