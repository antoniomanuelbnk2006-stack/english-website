# Registro de decisiones de arquitectura (ADR)

Cada ADR recoge **una** decisión: el contexto, lo que se decidió, las alternativas y las consecuencias. Si una decisión cambia, no se edita: se crea un ADR nuevo que la **sustituye** y se marca el antiguo como «Sustituida por ADR-XXXX».

| ADR | Decisión | Estado |
|---|---|---|
| [0001](0001-nextjs-app-router.md) | Next.js 16 con App Router como framework | Aceptada |
| [0002](0002-supabase-db-auth.md) | Supabase (Postgres + Auth OTP + RLS) para datos de usuario | Aceptada |
| [0003](0003-contenido-como-codigo.md) | El contenido vive como JSON versionado en el repo | Aceptada |
| [0004](0004-audio-en-r2.md) | Audio en Cloudflare R2 con URLs versionadas e inmutables | Aceptada |
| [0005](0005-tts-azure-con-abstraccion.md) | Azure AI Speech como TTS, tras una interfaz intercambiable | Aceptada |
| [0006](0006-fsrs-para-repaso.md) | FSRS (ts-fsrs) para la repetición espaciada | Aceptada |
| [0007](0007-ia-pregenerada-y-correccion.md) | IA pregenerada + corrección de writing en vivo con límites | Aceptada |
| [0008](0008-pwa-antes-que-app-nativa.md) | PWA antes que app nativa | Aceptada |
| [0009](0009-nivel-por-destreza-con-elo.md) | Nivel por destreza con rating tipo Elo + pruebas de confirmación | Aceptada |
| [0010](0010-un-solo-usuario.md) | Un solo usuario, con arquitectura multiusuario «dormida» | Aceptada |
| [0011](0011-e2e-con-emulador-de-supabase.md) | Tests e2e y de base de datos contra un emulador de Supabase en memoria | Aceptada |
| [0012](0012-use-of-english-y-nivel-declarado.md) | Sección «Use of English» con formato de examen y nivel elegido por el usuario | Aceptada |
| [0013](0013-escucha-con-transcripcion.md) | Modo «con transcripción» en las lecciones de escucha | Aceptada |
| [0014](0014-writing-revision-sin-ia.md) | Writing: revisión sin IA, respuesta modelo y detalles de la corrección con IA | Aceptada |
| [0015](0015-mazo-de-palabras-y-pronunciacion.md) | Mazo de palabras por nivel y pronunciación con el reconocimiento de voz del navegador | Aceptada |
| [0016](0016-diccionario-de-consulta-con-wiktionary.md) | Diccionario completo de consulta con Wiktionary | Aceptada |
| [0017](0017-simulacros-de-examen.md) | Simulacros de examen de Cambridge con formato y tiempo oficiales | Aceptada |
| [0018](0018-acceso-con-enlace-del-correo.md) | Acceso también con el enlace del correo (el plan gratuito de Supabase no deja editar la plantilla) | Aceptada |
| [0019](0019-audio-en-supabase-storage.md) | El audio, en el Storage del proyecto de Supabase (R2 sigue soportado) | Aceptada |
| [0020](0020-codigo-fijo-de-acceso.md) | Código fijo de acceso opcional (la contraseña de Supabase, derivada con un secreto del servidor) | Sustituida por ADR-0026 |
| [0021](0021-una-sola-direccion-y-codigo-fijo-primero.md) | Una sola dirección para la web (`SITE_URL`) y, con código fijo, el código por delante del correo | Aceptada |
| [0022](0022-diseno-de-la-presentacion-en-toda-la-web.md) | La presentación de Señal como portada pública y su lenguaje visual (pastillas, esquinas grandes, entradas animadas) en toda la app | Aceptada (el lenguaje visual, sustituido por ADR-0027) |
| [0023](0023-paleta-y-tipografia-de-la-presentacion.md) | Paleta (crema, azul marino, verde) y tipografía (Fraunces, Wix Madefor Text) de la presentación en toda la web | Sustituida por ADR-0027 |
| [0024](0024-bloqueo-de-acceso-y-registro-de-la-ia.md) | Bloqueo por intentos de acceso y registro del uso de la IA en tablas que la sesión solo puede leer | Aceptada |
| [0025](0025-politicas-rls-por-operacion.md) | Políticas RLS por operación, y solo las que cada tabla necesita | Aceptada |
| [0026](0026-contrasena-en-vez-de-codigo-fijo.md) | Contraseña de 12 caracteres o más en vez del código fijo, con el mismo mecanismo (derivada con el secreto del servidor) | Aceptada (cómo se pone, completado por ADR-0031) |
| [0027](0027-sistema-de-diseno-master.md) | Sistema de diseño «MASTER» en toda la web: oscuro, monocromo, un único acento cobalto, Inter y Archivo | Aceptada |
| [0028](0028-consentimiento-de-cookies.md) | Consentimiento de cookies: las necesarias siempre; las de preferencias (tema, idioma, acento), solo si el usuario las acepta | Aceptada (la duración de la sesión, modificada por ADR-0030) |
| [0029](0029-politica-de-privacidad-y-datos-de-contacto.md) | Política de privacidad, casilla obligatoria para aceptarla en el formulario de contacto y solo nombre y correo en el pie | Aceptada |
| [0030](0030-sesion-recordada-solo-con-cookies-aceptadas.md) | La sesión solo se recuerda al cerrar el navegador con las cookies aceptadas, y la política de privacidad se acepta en cada acceso | Aceptada |
| [0031](0031-contrasena-desde-la-web.md) | La contraseña se pone y se cambia en Ajustes; sin la actual, solo justo después de entrar con el correo; «¿Has olvidado la contraseña?» lleva hasta ahí | Aceptada |
| [0032](0032-cinco-idiomas-para-todo-el-publico.md) | Cinco idiomas (español, inglés, francés, chino y japonés), para todo el público, por fases; la interfaz, en el idioma del navegador | Aceptada |
| [0033](0033-tema-personalizado-con-css.md) | Tema personalizado: CSS propio guardado en el perfil que cambia toda la app; solo CSS y nada de fuera; `?sin-tema` lo desactiva | Aceptada |

Plantilla:

```md
# ADR-NNNN · Título

- **Estado:** Propuesta | Aceptada | Sustituida por ADR-XXXX
- **Fecha:** AAAA-MM-DD

## Contexto
## Decisión
## Alternativas consideradas
## Consecuencias
```
