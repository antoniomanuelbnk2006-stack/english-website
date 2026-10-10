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
| [0020](0020-codigo-fijo-de-acceso.md) | Código fijo de acceso opcional (la contraseña de Supabase, derivada con un secreto del servidor) | Aceptada |

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
