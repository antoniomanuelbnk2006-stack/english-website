# ADR-0018 · Acceso también con el enlace del correo

- **Estado:** Aceptada
- **Fecha:** 2026-10-10

## Contexto

El acceso se diseñó con **email + código de 6 dígitos**, y expresamente sin enlace mágico ([seguridad §2](../04-arquitectura/07-seguridad-y-privacidad.md#2-autenticación-un-solo-usuario)): en iOS el enlace se abre en Safari y no en la PWA instalada. Para que el correo traiga el código hay que editar la plantilla «Magic Link» de Supabase y poner `{{ .Token }}`.

Al crear el proyecto real de Supabase (10 de octubre de 2026) resultó que **el plan gratuito ya no deja editar las plantillas de correo con el servicio de envío por defecto**: la API responde «Email template modification is not available for free tier projects using the default email provider». Hace falta un plan de pago o un SMTP propio. La plantilla por defecto trae un **enlace**, así que con la app tal como estaba no se podía entrar.

De paso apareció otro desajuste: los proyectos nuevos envían códigos de **8** dígitos por defecto, y la app pide 6.

## Decisión

**La app acepta las dos cosas: el código y el enlace.** El código sigue siendo la vía preferida; el enlace es lo que funciona con un proyecto gratuito recién creado.

- Al pedir el correo, la acción manda a Supabase adónde debe volver el enlace: `/auth/confirm` en el mismo origen desde el que se pidió (`emailRedirectTo`). Supabase solo lo acepta si esa URL está en su lista de *Redirect URLs*.
- `src/app/auth/confirm/route.ts` recibe la vuelta. Supabase comprueba el enlace y añade un código de un solo uso (`?code=`); la ruta lo canjea por la sesión con `exchangeCodeForSession` (flujo PKCE, el que usa `@supabase/ssr` por defecto), comprueba que el email es el permitido y entra en `/hoy`.
- Si el enlace no sirve (caducado, ya usado, abierto en otro navegador o con un código que no es válido), vuelve a `/login?error=enlace` y la pantalla lo explica.
- `proxy.ts` deja pasar `/auth/confirm` sin sesión, igual que `/login`. Nada más cambia: el email permitido se sigue comprobando en el proxy y en la propia ruta.
- En el proyecto de Supabase se fija `otp_length = 6`, se desactiva el registro y se añaden las *Redirect URLs* (`…/auth/confirm` de producción y de `localhost:3000`).

## Alternativas consideradas

- **Configurar un SMTP propio** (Resend, Brevo, Gmail…) para poder editar la plantilla y mandar solo el código. Es lo que deja el acceso como se diseñó y quita los límites del envío por defecto (dos correos por hora, solo a miembros de la organización), pero obliga a abrir otra cuenta y a guardar otra credencial antes de poder entrar por primera vez. Sigue siendo la mejora recomendada; no excluye esta decisión.
- **Pasar a un plan de pago de Supabase.** Desproporcionado para una app de un solo usuario.
- **Enlace con `token_hash`** (`verifyOtp({ token_hash, type })`), que sí funciona en otro navegador. Requiere editar la plantilla, que es justo lo que no se puede.
- **Contraseña.** Descartada desde el principio (ADR-0002): otra cosa que guardar y que proteger.

## Consecuencias

- **El enlace solo funciona en el navegador que pidió el correo**: la otra mitad del canje (el *code verifier*) está en una cookie de ese navegador. Abrirlo en el móvil habiéndolo pedido en el ordenador lleva a la pantalla de acceso con el aviso. Es una limitación, pero también una protección: un enlace reenviado o interceptado no abre sesión en otro sitio.
- **En iOS, con la PWA instalada, el enlace se abre en Safari**: la sesión queda en Safari y no en la PWA. Para entrar en la PWA hace falta el código, es decir, el SMTP propio. Hasta entonces, en iPhone se usa desde Safari.
- Si el correo trae también el código (con SMTP propio y la plantilla editada), todo funciona como antes: se teclea y no hace falta el enlace.
- La superficie sin sesión crece en una ruta. Solo acepta un `code` con formato válido, redirige siempre a rutas internas fijas y no revela nada: cualquier fallo acaba en el mismo aviso.
- El emulador de los tests canjea un código fijo (`grant_type=pkce`), de modo que los e2e cubren el enlace bueno, el de otro navegador y el que no vale.
