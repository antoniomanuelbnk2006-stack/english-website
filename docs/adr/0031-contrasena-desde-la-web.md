# ADR-0031 · La contraseña se pone y se cambia desde la web

- **Estado:** Aceptada (completa [ADR-0026](0026-contrasena-en-vez-de-codigo-fijo.md): el comando sigue, como vía de emergencia)
- **Fecha:** 2026-10-14

## Contexto

Con el ADR-0026 la contraseña solo se podía poner con `pnpm auth:set-password`, desde el ordenador del dueño. Era un apaño para una web de una sola persona: desde el móvil no hay terminal, y si un día la web se abre a más gente nadie más podría ponerse una. El dueño pidió que la contraseña se ponga en el propio formulario, para la web y para la app móvil, que es esta misma web instalada ([ADR-0008](0008-pwa-antes-que-app-nativa.md)).

## Decisión

1. **Ajustes tiene un apartado «Contraseña»** (`/ajustes#contrasena`): la nueva, escrita dos veces, de 12 caracteres o más. Solo aparece si el servidor tiene `LOGIN_CODE_PEPPER`. Se guarda con `supabase.auth.updateUser`, derivada con el secreto como siempre: la app sigue sin guardar contraseñas.
2. **Sin la actual, solo justo después de entrar con el correo.** Si la sesión se abrió con el código o el enlace del correo hace menos de 10 minutos (el `amr` del token de Supabase), se puede poner sin escribir la anterior: entrar con el correo ya demuestra que el buzón es de quien la cambia. En cualquier otro caso se pide la actual. Así, quien se haga con una sesión abierta no puede cambiarla y dejar fuera al dueño.
3. **La actual se comprueba como un intento de acceso más:** pasa por `login_attempt_begin` y cuenta para el bloqueo ([ADR-0024](0024-bloqueo-de-acceso-y-registro-de-la-ia.md)).
4. **«¿Has olvidado la contraseña?»** en el paso de la contraseña del acceso: pide el correo de siempre y, al entrar con él (código o enlace), lleva a `/ajustes#contrasena` en vez de a Hoy. Como el enlace del correo vuelve siempre a `/auth/confirm`, ese «después» se recuerda en una cookie necesaria, `senal_next`, `HttpOnly`, de una hora, que se lee una sola vez. Pedir el correo para entrar sin más la borra.
5. **`pnpm auth:set-password` se queda** para lo que la web no puede hacer: quitar la contraseña (`--off`) o ponerla sin poder entrar de ninguna forma.

## Alternativas consideradas

- **El flujo de recuperación de Supabase** (`resetPasswordForEmail` y su correo de «recovery»). Es otro correo con otra plantilla, que en el plan gratuito no se puede editar, y con el mismo límite de dos correos por hora. El correo de acceso que ya existe sirve igual.
- **Pedir siempre la contraseña actual.** Quien la ha olvidado no podría ponerse otra sin el comando.
- **Pasar el «después» en la dirección de vuelta del enlace** (`/auth/confirm?siguiente=…`). Supabase solo vuelve a las direcciones de su lista permitida; con un parámetro nuevo, el enlace podría acabar en la dirección por defecto.
- **Registro con contraseña para otras personas.** Es el paso siguiente, pero necesita un correo propio (SMTP), quitar el email único ([ADR-0010](0010-un-solo-usuario.md)), unas condiciones de uso y decidir quién paga la IA de cada uno. Queda para cuando se abra la web.

## Consecuencias

- La política de cookies nombra `senal_next`.
- El emulador de los tests guarda las contraseñas cambiadas (en memoria), pone `amr` en sus tokens y rechaza la misma contraseña como Supabase (`same_password`). `tests/e2e/contrasena.spec.ts` prueba los tres caminos: recién entrado con el correo, con la contraseña actual y desde «¿Has olvidado la contraseña?» (con el código y con el enlace).
- Supabase tiene una opción, «Secure password change», que viene desactivada. Si se activa en el proyecto, `updateUser` pediría además un código por correo y este apartado dejaría de funcionar tal cual.
