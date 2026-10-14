# ADR-0028 · Consentimiento de cookies: las necesarias siempre, las de preferencias solo si se aceptan

- **Estado:** Aceptada
- **Fecha:** 2026-10-14

## Contexto

La web es pública (la portada y la pantalla de acceso las ve cualquiera) y guardaba cosas en el navegador sin preguntar: la sesión, y también el tema, el idioma y el acento elegidos. El dueño pidió que sea **el usuario quien acepte o rechace las cookies**.

Lo que la web guarda, entero:

| Qué | Dónde | Para qué |
|---|---|---|
| `sb-…-auth-token` (y `…-code-verifier` mientras se pide el enlace del correo) | Cookie `HttpOnly` | La sesión |
| `senal_consent` | Cookie | La decisión sobre las cookies |
| Borrador de un writing, examen empezado, textos del Writing de un simulacro | Almacenamiento local y de sesión | No perder lo que está a medias |
| `senal_theme`, `senal_locale` | Cookie | Tema e idioma de la interfaz |
| `senal:accent` | Almacenamiento local | Acento del audio modelo |

No hay analítica, ni publicidad, ni cookies de terceros.

La norma que aplica es el artículo 22.2 de la LSSI, con la guía de cookies de la AEPD como lectura práctica: lo estrictamente necesario para prestar el servicio pedido no necesita consentimiento; el resto sí, y rechazar tiene que ser tan fácil como aceptar. (Esto es la lectura hecha al implementarlo, no un dictamen jurídico.)

## Decisión

1. **Dos categorías.** *Necesarias*: la sesión, la propia decisión y lo que está a medias; van siempre. *De preferencias*: tema, idioma y acento; solo se guardan si se aceptan. La lista vive en `src/lib/consent.ts`.
2. **Sin decisión no se guarda ninguna preferencia.** No decidir equivale a rechazar; lo único que cambia es que el aviso sigue ahí.
3. **El aviso no bloquea.** Es una capa flotante al pie, sin fondo oscurecido ni foco atrapado: la web se puede usar entera sin contestar. La página gana por abajo el alto del aviso, así que nada queda tapado sin remedio, y en el móvil va por encima de la barra de navegación.
4. **«Rechazar» y «Aceptar» pesan lo mismo:** el mismo botón (terciario con borde), uno junto al otro. Ninguno es la acción cobalto de la pantalla.
5. **La decisión se guarda en la cookie `senal_consent`** (`v1.all` o `v1.necessary`), seis meses, y después se vuelve a preguntar. La escribe el navegador, no el servidor: la portada es HTML estático y tiene que poder guardarla sin pasar por la app; no contiene nada sensible. El `v1` permite volver a preguntar a todo el mundo si un día cambian las categorías.
6. **Rechazar no quita funciones.** Sin las cookies de preferencias, el tema y el idioma salen del perfil de quien ha entrado (`src/lib/preferences.ts`): una lectura más por petición, y la interfaz se ve igual. El acento vale para la visita y vuelve al británico en la siguiente.
7. **Rechazar deshace.** Al pasar a «solo las necesarias» se borran las cookies de preferencias y el acento guardado.
8. **Cambiar de opinión es tan fácil como decidir:** en Ajustes («Cookies»), en el pie de la portada («Configurar cookies») y en la propia política.
9. **Una política de cookies pública**, `/landing/cookies.html`, que nombra cada cookie, para qué sirve y cuánto dura. Se enlaza desde el aviso, el pie de la portada, la pantalla de acceso y Ajustes.
10. **Sin cookies de terceros.** Las fotos de la portada (Wix) y el audio (Supabase Storage) se piden con `crossorigin="anonymous"`, es decir, sin credenciales: el navegador ni envía ni guarda cookies de esos dominios.

## Alternativas consideradas

- **No preguntar**, con el argumento de que todo es técnico o elegido por el propio usuario (la guía de la AEPD exime las preferencias que el usuario fija él mismo). Defendible, pero el dueño pidió que el usuario decida, y preguntar por tres preferencias no le cuesta nada a nadie.
- **Guardar la decisión en el perfil.** No sirve antes de entrar ni en la portada, que es donde llega quien no tiene cuenta.
- **Escribir la cookie desde el servidor**, con `HttpOnly`. La portada estática no tiene con qué; y serían dos mecanismos para una misma cookie.
- **Un diálogo que bloquee hasta contestar.** Obliga a decidir para poder leer, que es justo lo que la norma no quiere, y estorba en una web donde rechazar no cambia nada.
- **«Aceptar» como botón principal.** Empuja hacia una respuesta. Además sería una segunda acción cobalto en pantalla (MASTER §5).

## Consecuencias

- Quien rechaza, o no contesta, añade una lectura del perfil a cada petición (se hace una vez por petición, con `cache`). Quien acepta sigue como antes.
- De paso, un navegador nuevo ya no arranca con el tema por defecto hasta guardar Ajustes: sin cookies, toma el del perfil.
- `public/landing/app.js` repite el nombre de la cookie, su versión, su duración y la lista de preferencias; `src/lib/consent.test.ts` falla si dejan de coincidir con `src/lib/consent.ts`.
- **Todo lo nuevo que se guarde en el navegador hay que clasificarlo**: si es una preferencia, pasa por `preferencesAllowed()` y se añade a la lista; en cualquier caso, se añade a la política. Una analítica o cualquier cosa de terceros sería una tercera categoría, con su propio interruptor.
- Los tests e2e arrancan con las cookies aceptadas (`playwright.config.ts`) para que el aviso no se cruce en cada pantalla; `tests/e2e/cookies.spec.ts` empieza como una visita nueva.
- **No hay política de privacidad ni condiciones de uso.** La web no las tenía y este ADR no las crea: una política de privacidad tiene que decir quién es el responsable de los datos, y eso lo tiene que dar el dueño.
