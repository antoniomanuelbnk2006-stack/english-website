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
3. **Lista de emails permitidos** (`ALLOWED_EMAIL`) comprobada en `proxy.ts` **y** en cada Server Action/Route Handler (defensa en profundidad).
4. Sesión en **cookies HttpOnly** gestionadas por `@supabase/ssr`; el *token* se refresca en `proxy.ts`.

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|serwist/|.*\\.(?:png|svg|jpg|webp|ico)$).*)'],
};
```

Sigue la guía oficial de Supabase para Next.js con `proxy.ts` y comprueba los detalles con la versión instalada.

---

## 3. Autorización y datos

- **RLS en todas las tablas** con `user_id = (select auth.uid())` ([Base de datos](03-base-de-datos.md#2-migración-base)).
- La app **no usa la clave *secret*** de Supabase en ningún punto: todas las consultas van como el usuario autenticado. La clave *secret* solo existe en tu máquina para scripts puntuales (*seed*, copias).
- Funciones SQL con `security invoker` y `search_path` vacío.
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
| `Permissions-Policy` | `camera=(), geolocation=(), microphone=(self)` |
| `Strict-Transport-Security` | La pone Vercel; en dominio propio, `max-age=63072000; includeSubDomains` |

**CORS de R2:** permitir `GET` y `HEAD` solo desde el origen de la app y exponer `Accept-Ranges`, `Content-Range` y `Content-Length` (necesario para el audio con peticiones por rango y su caché en el *service worker*; ver [PWA](08-pwa-rendimiento-accesibilidad.md#3-audio-sin-conexión)).

**CSRF:** las Server Actions comprueban el origen por diseño; el Route Handler de IA exige sesión y comprueba la cabecera `Origin`.

---

## 6. La transcripción «escondida»

En la fase 1 de una lección de escucha, el cliente **no recibe** la transcripción (se pide al servidor al completar la fase 2). Es un caso curioso de «seguridad contra uno mismo»: elimina la tentación de mirar. Las lecciones **descargadas** para uso sin conexión sí la incluyen, oculta en la interfaz.

---

## 7. Privacidad y RGPD

Aunque el único interesado seas tú:
- **Minimización:** solo se guarda lo necesario para el aprendizaje. Sin analítica de terceros por defecto.
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
- `pnpm audit` en CI (no bloqueante para avisos bajos; bloqueante para críticos).

---

## 9. Copias de seguridad

Ver [Base de datos §6](03-base-de-datos.md#6-copias-de-seguridad). El contenido está en git y el audio se puede regenerar (o re-subir desde tu copia local de `.audio-cache/`).
