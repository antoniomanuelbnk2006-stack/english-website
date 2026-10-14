# ADR-0026 · Contraseña de verdad en vez del código fijo

- **Estado:** Aceptada (sustituye a [ADR-0020](0020-codigo-fijo-de-acceso.md); desde el [ADR-0031](0031-contrasena-desde-la-web.md) también se pone y se cambia en Ajustes, y el comando queda como vía de emergencia)
- **Fecha:** 2026-10-13

## Contexto

El código fijo ([ADR-0020](0020-codigo-fijo-de-acceso.md)) permitía entrar sin depender del correo, pero eran de 4 a 8 cifras: como mucho cien millones de posibilidades, y muchísimas menos si el código es una fecha o una secuencia. El email no es un secreto (está en los *commits* y en el pie de la portada), así que el código era la única barrera. El bloqueo por intentos ([ADR-0024](0024-bloqueo-de-acceso-y-registro-de-la-ia.md)) frena la fuerza bruta, pero no salva un código que cualquiera probaría entre los quince primeros.

## Decisión

**El código fijo se sustituye por una contraseña de 12 caracteres o más**, con el mismo mecanismo por dentro.

- Lo que llega a Supabase sigue sin ser lo que escribe el usuario: es `HMAC-SHA256(secreto, email + contraseña)`, con el secreto del servidor `LOGIN_CODE_PEPPER`. Sin ese secreto nadie puede probar contraseñas directamente contra Supabase; hay que pasar por la app, que cuenta los intentos.
- **No conviven**: Supabase guarda una sola contraseña por usuario, y mantener un código corto al lado dejaría abierta la puerta débil. Los códigos de 4 a 8 cifras dejan de valer: ni el formulario ni el servidor admiten menos de 12 caracteres.
- En la pantalla de acceso, el botón principal es «Entrar con mi contraseña». El campo es de tipo contraseña (no se ve al escribir) y va marcado para el gestor de contraseñas del navegador, con el email en el mismo formulario: la puede guardar y rellenar él.
- Se pone con `pnpm auth:set-password`, que la pide por teclado sin mostrarla (dos veces), o con `--generate`, que crea una al azar de cinco grupos de cuatro letras y cifras (unos 99 bits) y la enseña una sola vez. **No se pasa como argumento**: quedaría en el historial del terminal. `--off` la quita.
- El acceso con el enlace del correo no cambia: sigue siendo la vía de recuperación. Poner la contraseña también levanta el bloqueo por intentos.
- La variable sigue llamándose `LOGIN_CODE_PEPPER`: renombrarla obligaría a cambiarla en Vercel y en `.env.pipeline` sin ganar nada.

## Alternativas consideradas

- **Una contraseña normal de Supabase**, sin derivar. Se podría probar desde fuera, directamente contra la API de Supabase con la clave *publishable*, saltándose el bloqueo de la app.
- **Admitir las dos cosas** (código o contraseña, lo que se haya puesto). Deja elegir la opción débil, que es justo lo que se quiere retirar.
- **Una sola pantalla con email y contraseña.** Es lo más habitual y lo que mejor entienden los gestores de contraseñas, pero cambia el flujo de dos pasos que comparten la contraseña y el correo; con el email oculto en el segundo paso el gestor funciona igual.
- **Llaves de acceso (*passkeys*).** Sin secreto que adivinar y cómodas en el móvil; quedan para más adelante.

## Consecuencias

- **Al desplegar, el código antiguo deja de servir.** Hay que poner la contraseña con `pnpm auth:set-password` justo después. Entre una cosa y otra solo se entra con el enlace del correo; las sesiones abiertas siguen valiendo.
- La seguridad del acceso pasa a ser la de la contraseña. Con 12 caracteres al azar, el bloqueo (unos quince intentos el primer día y uno al día después) la deja fuera del alcance de la fuerza bruta; una frase obvia sigue siendo obvia.
- Si se olvida: entrar con el enlace del correo o volver a ejecutar `pnpm auth:set-password` desde el ordenador del dueño.
- Si se filtra `LOGIN_CODE_PEPPER`: cambiarlo en Vercel y en `.env.pipeline` y volver a poner la contraseña.
- `pnpm auth:set-code` desaparece; donde otros documentos lo nombren, léase `pnpm auth:set-password`.
- Los tests e2e llevan la contraseña activada con un secreto de pruebas; el emulador deriva la misma y acepta `grant_type=password`.
