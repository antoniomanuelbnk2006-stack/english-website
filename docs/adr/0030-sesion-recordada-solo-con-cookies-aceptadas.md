# ADR-0030 · La sesión solo se recuerda con las cookies aceptadas, y la privacidad se acepta al entrar

- **Estado:** Aceptada (modifica [ADR-0028](0028-consentimiento-de-cookies.md) en cuánto dura la sesión)
- **Fecha:** 2026-10-14

## Contexto

Con el ADR-0028, rechazar las cookies solo quitaba las de preferencias: la cookie de la sesión duraba 400 días igualmente (es lo que pone `@supabase/ssr`), así que quien rechazaba seguía dentro al volver días después. El dueño pidió que, si se rechazan las cookies, **al volver a entrar haya que iniciar sesión otra vez y volver a aceptar la política de privacidad**.

## Decisión

1. **Recordar la sesión es algo que se acepta.** Con las cookies aceptadas (`senal_consent=v1.all`), la cookie de la sesión dura lo de siempre: hasta cerrar sesión, 400 días como mucho. Si se rechazan o no se ha decidido, se escribe **sin caducidad**: el navegador la borra al cerrarse. La sesión sigue siendo una cookie necesaria; lo que depende del consentimiento es que sobreviva al navegador.
2. **Dónde se decide:** en los dos sitios que escriben las cookies de Supabase, el cliente del servidor y el proxy. Los dos pasan las opciones por `sessionCookieOptions` (`src/lib/supabase/cookies.ts`), que quita `maxAge` y `expires` cuando no hay que recordar. Las cookies que se están borrando no se tocan.
3. **El cambio llega en el momento:** al decidir en el aviso de la app o en Ajustes, la acción `applyConsentToSession` vuelve a escribir las cookies de la sesión abierta con la duración que toca. Desde las páginas estáticas de la portada no se puede llamar a una acción: ahí el cambio llega en la siguiente renovación de la sesión, que es como mucho una hora.
4. **La política de privacidad se acepta en cada acceso:** casilla sin marcar en la pantalla de acceso, delante del email y la contraseña o el correo. Sin marcarla no se pasa al siguiente paso, y el servidor rechaza también las acciones de acceso que no la traen (`privacy: z.literal(true)`). Con la sesión recordada no se vuelve a pedir hasta que se cierre sesión; sin recordar, cada vez que se abre el navegador.

## Alternativas consideradas

- **Cerrar la sesión al rechazar.** Echa a quien acaba de decidir, en medio de lo que estuviera haciendo, y no es lo que se pidió: lo pedido es que no se recuerde al volver.
- **Una caducidad corta (un día, una hora) en vez de ninguna.** Sería una cookie persistente igualmente, solo que más corta, y cortaría a mitad de una sesión larga de estudio.
- **Guardar en el perfil que se aceptó la privacidad** y no volver a preguntar. El dueño pidió que se vuelva a aceptar; y una marca así necesitaría una migración.

## Consecuencias

- Quien rechaza las cookies entra cada vez que abre el navegador. Los navegadores que reabren las pestañas de la última vez («Continuar donde lo dejaste» en Chrome) también recuperan las cookies sin caducidad: ahí la sesión puede seguir viva. Es comportamiento del navegador; la cookie está bien escrita (en las herramientas del navegador, su caducidad es «Sesión»).
- Los tests e2e arrancan con las cookies aceptadas, así que sus sesiones se recuerdan, como antes. `tests/e2e/cookies.spec.ts` comprueba las dos duraciones, el cambio en el momento desde el aviso y desde Ajustes, y que tras «cerrar el navegador» hay que entrar y aceptar otra vez. Todos los accesos de los tests marcan la casilla (`acceptPrivacy`).
- Si `@supabase/ssr` cambia su duración por defecto, `src/lib/supabase/cookies.test.ts` lo avisa.
