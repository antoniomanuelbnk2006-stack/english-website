# ADR-0021 · Una sola dirección para la web, y el código fijo por delante

- **Estado:** Aceptada
- **Fecha:** 2026-10-10

## Contexto

El mismo día en que se activó el código fijo ([ADR-0020](0020-codigo-fijo-de-acceso.md)), el dueño no pudo entrar con él. Se juntaron dos cosas:

1. **Estaba en la dirección de un despliegue antiguo.** Vercel deja a cada despliegue una dirección propia (`<proyecto>-<hash>-<equipo>.vercel.app`) que sigue viva, **congelada en esa versión y con las variables de entorno de entonces**. La que tenía abierta era de antes del código fijo: la misma pantalla de acceso, sin el botón y con un servidor que no lo conocía. Nada en la pantalla lo delataba.
2. **Pulsaba «Enviar código», que era el botón principal.** Con un código fijo en la cabeza, se lee como «enviar mi código». Cada pulsación pedía un correo a Supabase, que en el plan gratuito envía dos por hora, y el resultado era «Demasiados intentos. Espera un minuto», que tampoco era verdad: el límite es por hora.

## Decisión

**1. La web tiene una sola dirección.** Con la variable `SITE_URL` (la dirección pública de la web), `src/proxy.ts` redirige con un 307 a esa dirección, conservando ruta y consulta, todo lo que llegue por otro nombre: los despliegues con dirección propia y los alias de Vercel. Es lo primero que hace, antes de mirar la sesión. Sin `SITE_URL` (desarrollo, la demo) no se redirige nada.

- El nombre por el que llega la petición se lee de la cabecera `x-forwarded-host` o `host`, no de `nextUrl`, que fuera de Vercel no lo lleva.
- El destino se compone con el origen de `SITE_URL` y la ruta pedida, sin interpretarla: una ruta como `//otro.sitio` no puede sacar de la web (`src/lib/site-url.ts`, con tests).
- **Lo que llega por una dirección local (`localhost`, `127.0.0.1`, `[::1]`) nunca se redirige**: no es un despliegue antiguo, y así un `SITE_URL` de producción en `.env.local` no saca del ordenador a quien desarrolla.

**2. Con código fijo, el código va primero.** Si el servidor tiene `LOGIN_CODE_PEPPER`:

- El botón principal de la pantalla de acceso —y lo que hace Intro— es **«Entrar con mi código fijo»**; pedir el correo pasa a ser el botón secundario.
- El texto de la pantalla lo dice: «Escribe tu email y entra con tu código fijo».

**3. Los nombres dicen lo que pasa.** El botón del correo se llama **«Enviarme el correo»** (antes «Enviar código»), con o sin código fijo. Y si Supabase rechaza el envío por su límite, el aviso habla de correos y de esperar un rato, no de un minuto.

## Alternativas consideradas

- **Una redirección por nombre de *host* en `vercel.json`.** Obliga a escribir el dominio en el repositorio y no se puede probar; con la variable, el mismo código vale para cualquier dominio y lo cubren los tests.
- **`VERCEL_PROJECT_PRODUCTION_URL`**, que Vercel rellena solo. Elige él el dominio (el más corto), y uno de los dos que tiene el proyecto está detrás del inicio de sesión de Vercel: si eligiera ese, la web pública redirigiría a una dirección que pide otra contraseña.
- **Borrar los despliegues antiguos.** Hace que sus direcciones dejen de responder, pero cada *push* crea una nueva: sirve para los que ya existían, no para los siguientes.
- **Una sola pantalla con email y código.** Más directa cuando hay código fijo, pero son dos formularios distintos que mantener; con el orden de los botones basta.

## Consecuencias

- **Los despliegues anteriores a este no redirigen**: llevan el código de entonces. Sus direcciones siguen mostrando una web antigua hasta que se borren en Vercel.
- Desde este despliegue, abrir cualquier dirección del proyecto lleva a la buena. A cambio, un despliegue antiguo ya no se puede mirar en el navegador; para volver a una versión anterior se usa la *promoción* de Vercel, no su dirección.
- **Si cambia el dominio** hay que cambiar `SITE_URL` en Vercel, además de la *Site URL* y las *Redirect URLs* de Supabase. Si se queda con el antiguo, el dominio nuevo redirige al viejo.
- Un `SITE_URL` mal escrito manda toda la web a otro sitio: el esquema de entorno solo comprueba que sea una URL `http(s)`. Tras cambiarlo, hay que abrir la web.
- **Lo que prueban los tests y lo que no.** `canonicalUrl` tiene tests unitarios del destino. En los e2e, `SITE_URL` es `http://localhost:3100` y una petición con la cabecera `Host` de otro nombre recibe un 307; el destino completo no se ve allí, porque fuera de Vercel Next cree que su dirección es la del servidor y escribe como relativa una redirección a ella. En Vercel, donde el nombre pedido es el real, la redirección solo se puede ver abriendo una dirección de despliegue con la sesión de Vercel iniciada.
- Como en los e2e el código fijo está activado, Intro en la pantalla de acceso lleva al código fijo.
