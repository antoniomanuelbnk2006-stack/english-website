# Seguridad y privacidad

> **Propósito:** qué podría salir mal en una app personal y cómo lo evitamos sin complicarla.
> **Relacionado:** [Base de datos](03-base-de-datos.md) · [IA](06-ia.md) · [Entornos y despliegue](../06-desarrollo/04-entornos-y-despliegue.md) · [ADR-0010](../adr/0010-un-solo-usuario.md)

---

## 1. Modelo de amenazas (realista)

| Riesgo | Impacto | Probabilidad | Control principal |
|---|---|---|---|
| Fuga de la clave de la API de Claude | Gasto no autorizado | Media | Clave solo en servidor + tope en la app + límite de gasto en la consola |
| Fuga de credenciales de R2 o de la clave *secret* de Supabase | Borrado/alteración de datos o audio | Baja | Solo en tu `.env.pipeline` local; nunca en Vercel ni en el repo |
| Otra persona accede a la app | Lee tu progreso, gasta tu IA | Baja | Registro desactivado + OTP + lista de emails permitidos + RLS |
| Pérdida de datos | Pierdes tu historial | Media | Exportación + volcados semanales |
| Dependencia comprometida o vulnerable | Variable | Media | *Lockfile*, actualizaciones, avisos de seguridad de Next.js |
| Inyección en prompts | Feedback manipulado | Muy baja (los textos son tuyos) | Texto del usuario delimitado como datos |

---

## 2. Autenticación: un solo usuario

1. **Supabase Auth con email + código OTP de 6 dígitos**, que se teclea dentro de la app. Se prefiere al enlace mágico porque en iOS el enlace se abre en Safari y no en la PWA instalada. Aun así la app **acepta también el enlace** del correo ([ADR-0018](../adr/0018-acceso-con-enlace-del-correo.md)): el plan gratuito de Supabase no deja editar la plantilla para que traiga el código si no se configura un SMTP propio. El enlace solo abre sesión en el navegador que pidió el correo.
2. **Registro desactivado** en Supabase (*Authentication → Sign In / Providers → Allow new users to sign up*: off). Tu usuario se crea una vez, a mano o con el primer OTP antes de desactivarlo.
3. **Lista de emails permitidos** (`ALLOWED_EMAIL`) comprobada en `proxy.ts` **y** en cada pantalla privada, Server Action y Route Handler (defensa en profundidad). Cada página de `src/app/(app)` empieza por `await getSessionOrRedirect()`, antes de leer contenido o llamar a nadie: el `matcher` del proxy puede dejar huecos y el layout no se vuelve a ejecutar al navegar entre pantallas hermanas. `src/app/session-checks.test.ts` lee el código y falla si una pantalla, una acción o un Route Handler nuevo se olvida.
4. Sesión en **cookies `HttpOnly` y `Secure`** gestionadas por `@supabase/ssr`; el *token* se refresca en `proxy.ts`. La librería las deja legibles desde JavaScript por defecto (su cliente de navegador las necesita); como esta app solo habla con Supabase desde el servidor, `src/lib/supabase/cookies.ts` las cierra en los dos clientes. Los navegadores aceptan `Secure` en `http://localhost`, que es como corren el desarrollo, la demo y los tests. **Solo duran más que el navegador si se han aceptado las cookies** ([ADR-0030](../adr/0030-sesion-recordada-solo-con-cookies-aceptadas.md)): si no, se escriben sin caducidad y al volver hay que entrar otra vez.
5. **Contraseña opcional** ([ADR-0026](../adr/0026-contrasena-en-vez-de-codigo-fijo.md), que sustituye al código fijo del ADR-0020): si el servidor tiene `LOGIN_CODE_PEPPER`, se puede entrar con una contraseña de 12 caracteres o más sin pasar por el correo. No se guarda en la app: a Supabase llega otra, derivada de ella con ese secreto, así que nadie puede probar contraseñas contra Supabase sin pasar por la app. Se pone y se cambia en Ajustes ([ADR-0031](../adr/0031-contrasena-desde-la-web.md)): sin la actual solo en los 10 minutos siguientes a entrar con el correo, y la actual cuenta como un intento de acceso. «¿Has olvidado la contraseña?» pide el correo y, al entrar, lleva a ponerla. `pnpm auth:set-password` queda para emergencias: la pide sin mostrarla o la genera; nunca va como argumento.
6. **Una sola dirección** ([ADR-0021](../adr/0021-una-sola-direccion-y-codigo-fijo-primero.md)): con `SITE_URL`, `proxy.ts` redirige a la dirección de la web lo que llegue por otro nombre, antes de mirar la sesión. Así nadie acaba, sin saberlo, en un despliegue antiguo con el código y las variables de entonces.
7. **Bloqueo por intentos** ([ADR-0024](../adr/0024-bloqueo-de-acceso-y-registro-de-la-ia.md)): la app anota cada contraseña o código que se prueba antes de probarlo. Tras cinco seguidos sin acertar, el acceso se cierra 1, 2, 4… minutos, hasta 24 horas; entrar pone la cuenta a cero. El enlace del correo no pasa por el bloqueo y lo levanta, y `pnpm auth:set-password` también. No depende del límite por IP de Supabase, que solo ve la IP del servidor de la app.

```ts
// src/lib/supabase/proxy.ts (resumen)
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // No ejecutes nada entre createServerClient y esta llamada (refresca la sesión).
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  const path = request.nextUrl.pathname;
  const isPublic = path === '/login' || path.startsWith('/auth/');
  if (!isPublic && email !== process.env.ALLOWED_EMAIL) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c)); // conserva cookies refrescadas
    return redirect;
  }
  return response;
}
```

```ts
// proxy.ts (raíz)
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|serwist/|dev-audio/|landing/).*)'],
};
```

Las excepciones del `matcher` son carpetas y ficheros concretos, **nunca extensiones**: una regla como «todo lo que acabe en `.png`» deja fuera del proxy a `/leer/lo-que-sea.png`, que es una pantalla privada.

Sigue la guía oficial de Supabase para Next.js con `proxy.ts` y comprueba los detalles con la versión instalada.

---

## 3. Autorización y datos

- **RLS en todas las tablas** con `user_id = (select auth.uid())` ([Base de datos](03-base-de-datos.md#2-migración-base)), con **una política por operación** y solo las que la app usa: los historiales solo admiten añadir y nada se borra salvo el diario ([ADR-0025](../adr/0025-politicas-rls-por-operacion.md)).
- **El bucket de audio** es público para leer, pero solo admite `audio/mp4` y hasta 20 MB (`AUDIO_BUCKET_LIMITS` en `scripts/content/lib/audio-stores.ts`), y no tiene políticas de escritura: solo se sube con la clave *secret*, desde el pipeline.
- La app **no usa la clave *secret*** de Supabase en ningún punto: todas las consultas van como el usuario autenticado. La clave *secret* solo existe en tu máquina para scripts puntuales (*seed*, copias).
- Funciones SQL con `security invoker` y `search_path` vacío.
- **Lo que no debe poder cambiar ni quien tenga la sesión** (los intentos de acceso y el uso de la IA) va en tablas que el usuario solo puede leer, `login_attempts` y `ai_usage`. Las escriben cuatro funciones `security definer` hechas para que llamarlas a mano no sirva de nada: solo saben sumar, y cerrar una reserva de la IA exige un resguardo que no sale del servidor ([ADR-0024](../adr/0024-bloqueo-de-acceso-y-registro-de-la-ia.md)). Así los límites de la IA aguantan aunque alguien entre en la cuenta, y siguen sin hacer falta claves *secret* en la app.
- Las Server Actions validan su entrada con Zod y comprueban sesión y email.

---

## 4. Secretos y variables de entorno

| Variable | Dónde | Cliente |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + local | Sí (son públicas por diseño) |
| `NEXT_PUBLIC_AUDIO_BASE_URL` | Vercel + local | Sí |
| `ALLOWED_EMAIL` | Vercel + local | No |
| `ANTHROPIC_API_KEY`, `AI_*` | Vercel + local | **No** |
| `SUPABASE_SECRET_KEY` | Solo `.env.pipeline` local | **No** |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Solo `.env.pipeline` local | **No** |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Solo `.env.pipeline` local | **No** |

- `src/lib/env.ts` valida con Zod las variables al arrancar (falla rápido si falta algo) y separa las de servidor (importa `server-only`).
- `.env*` en `.gitignore`; `.env.example` con nombres y sin valores.
- Rota una clave si alguna vez aparece en un *commit*, un log o una captura.

---

## 5. Cabeceras y navegador

En `next.config.ts` (`headers()`) y, para la CSP con *nonce*, en `proxy.ts` siguiendo la guía de CSP de Next.js:

| Cabecera | Valor |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: {AUDIO_ORIGIN}; connect-src 'self' {SUPABASE_URL} {AUDIO_ORIGIN}; font-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (lo mismo que `frame-ancestors 'none'`, para navegadores antiguos y para lo que se sirve sin CSP) |
| `Permissions-Policy` | `camera=(), geolocation=(), microphone=(self)` |
| `Strict-Transport-Security` | La pone Vercel; en dominio propio, `max-age=63072000; includeSubDomains` |

**La portada pública** (`/` sin sesión y `/landing/*`) es HTML estático y no puede llevar la CSP con *nonce* de la app. Lleva la suya, fija, desde `next.config.ts`: `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: https://static.wixstatic.com; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. Comparte origen con la app, así que solo admite lo que esas páginas cargan de verdad: su script, su hoja de estilos (sin estilos en el propio HTML), sus fuentes —servidas desde `/landing/fonts`— y las fotos de Wix. Si la portada estrena un origen nuevo (otra fuente, un vídeo, una analítica), hay que añadirlo ahí.

**CORS de R2:** permitir `GET` y `HEAD` solo desde el origen de la app y exponer `Accept-Ranges`, `Content-Range` y `Content-Length` (necesario para el audio con peticiones por rango y su caché en el *service worker*; ver [PWA](08-pwa-rendimiento-accesibilidad.md#3-audio-sin-conexión)).

**CSRF:** las Server Actions comprueban el origen por diseño; el Route Handler de IA exige sesión y comprueba la cabecera `Origin`.

**Tema personalizado** ([ADR-0033](../adr/0033-tema-personalizado-con-css.md)): cada uno puede guardar su propio CSS, que el layout pinta en un `<style>` solo para su sesión. Por eso `style-src` tiene que seguir admitiendo `'unsafe-inline'`. `checkThemeCss` lo comprueba en el navegador y otra vez en el servidor: sin `<` (no puede cerrar la etiqueta), sin `@import`, sin `javascript:`/`expression(`/`-moz-binding`/`behavior:` y como mucho 50.000 caracteres. Lo que de verdad impide que cargue o mande algo fuera es la CSP: `img-src` y `font-src` no admiten otros orígenes. Si algún día se abren, hay que revisar esto. `?sin-tema` desactiva el tema en cualquier página.

---

## 6. La transcripción «escondida»

En la fase 1 de una lección de escucha, el cliente **no recibe** la transcripción (se pide al servidor al completar la fase 2). Es un caso curioso de «seguridad contra uno mismo»: elimina la tentación de mirar. Las lecciones **descargadas** para uso sin conexión sí la incluyen, oculta en la interfaz.

---

## 7. Privacidad y RGPD

Aunque el único interesado seas tú:
- **Minimización:** solo se guarda lo necesario para el aprendizaje. Sin analítica de terceros por defecto.
- **Cookies:** las decide quien visita la web ([ADR-0028](../adr/0028-consentimiento-de-cookies.md)). Las necesarias (la sesión, la propia decisión y lo que está a medias) van siempre; las de preferencias (`senal_theme`, `senal_locale` y el acento, en almacenamiento local) solo si se aceptan, y sin ellas el tema y el idioma salen del perfil. El aviso no bloquea y «Rechazar» pesa lo mismo que «Aceptar». Aceptarlas es también lo que hace que la sesión se recuerde al cerrar el navegador (ADR-0030). La decisión se cambia en Ajustes, en el pie de la portada y en la política, `/landing/cookies.html`, que hay que actualizar cada vez que la web guarde algo nuevo en el navegador. Las fotos de Wix y el audio de Supabase se piden sin credenciales: no hay cookies de terceros.
- **Política de privacidad:** `/landing/privacidad.html` ([ADR-0029](../adr/0029-politica-de-privacidad-y-datos-de-contacto.md)). El responsable es el dueño, con su nombre y su correo; es lo único que el pie enseña (sin teléfono ni dirección). El formulario de contacto no se envía sin marcar la casilla que la acepta, y la pantalla de acceso tampoco deja entrar sin aceptarla, cada vez (ADR-0030). Cualquier dato o proveedor nuevo hay que contarlo en ella. No hay condiciones de uso: harán falta si se abre el registro.
- **Ubicación:** proyecto de Supabase en **región de la UE**; R2 con *location hint* en Europa; región de funciones de Vercel cercana a Supabase si tu plan lo permite (menos latencia).
- **Exportar y borrar:** desde Ajustes (JSON completo y borrado de la cuenta con cascada).
- **Sentry (si lo usas):** sin IP ni cuerpos de petición; filtrado de PII activado.
- **Grabaciones de voz** (*shadowing*): solo en el dispositivo, caducan a los 7 días.
- **Pronunciación:** el audio del micrófono **no pasa por Señal**. Lo procesa el servicio de reconocimiento de voz del navegador (Google en Chrome, Microsoft en Edge) y la app solo recibe el texto reconocido, del que guarda la mejor hipótesis de cada ítem. El micrófono se abre solo al pulsar «Hablar» y se avisa en la pantalla ([ADR-0015](../adr/0015-mazo-de-palabras-y-pronunciacion.md)). `Permissions-Policy` limita el micrófono al propio origen.
- **Diccionario completo:** al buscar una palabra, el **servidor** de la app la consulta en Wiktionary (Wikimedia). Solo viaja la palabra buscada, sin cookies ni nada que identifique al usuario; el navegador no habla con ningún dominio externo, así que la CSP no cambia. Las respuestas se validan y se reducen a texto plano antes de pintarlas ([ADR-0016](../adr/0016-diccionario-de-consulta-con-wiktionary.md)).
- **Simulacros de Speaking:** la respuesta se graba con el micrófono para que el usuario se escuche, pero la grabación **no sale del navegador**: vive en memoria (`blob:`) y se borra al salir de la página. Al servidor solo llega la autoevaluación. Las preguntas las dice la voz del propio navegador ([ADR-0017](../adr/0017-simulacros-de-examen.md)).
- **Simulacros de Reading y Listening:** las respuestas, las explicaciones y los guiones de las grabaciones no viajan al navegador hasta que la prueba se entrega; la prueba en curso de Reading se guarda solo en el almacenamiento local del navegador ([ADR-0017](../adr/0017-simulacros-de-examen.md)).

---

## 8. Dependencias y actualizaciones

- `pnpm-lock.yaml` versionado; actualizaciones semanales con Renovate o Dependabot (agrupadas).
- **Next.js publica versiones de seguridad programadas**: suscríbete a su blog/avisos y actualiza el mismo día.
- `pnpm audit --prod --audit-level high` en CI: un aviso alto o crítico en lo que se despliega para el CI. Las herramientas de desarrollo no llegan a producción y quedan para Dependabot.
- `.github/dependabot.yml`: PR semanales agrupadas (producción y desarrollo por separado; los saltos de versión mayor, sueltos) y las acciones de GitHub. Los **avisos** de seguridad se activan aparte, en *Settings → Code security*.

---

## 9. Copias de seguridad

Ver [Base de datos §6](03-base-de-datos.md#6-copias-de-seguridad). El contenido está en git y el audio se puede regenerar (o re-subir desde tu copia local de `.audio-cache/`).
