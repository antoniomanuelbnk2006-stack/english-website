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
