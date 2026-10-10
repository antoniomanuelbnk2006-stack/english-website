# ADR-0020 · Código fijo de acceso (opcional)

- **Estado:** Aceptada
- **Fecha:** 2026-10-10

## Contexto

Con el plan gratuito de Supabase, entrar depende de un correo que trae un enlace ([ADR-0018](0018-acceso-con-enlace-del-correo.md)): como mucho dos correos por hora, y el enlace solo sirve en el navegador que lo pidió. El dueño pidió **entrar siempre con el mismo código**, sin pasar por el correo, como en la demo local.

## Decisión

**Un código fijo opcional, que por dentro es la contraseña del usuario en Supabase Auth.**

- El código (de 4 a 8 cifras) **no se guarda en ningún sitio**: ni en el repositorio, ni en una variable de entorno, ni en la base de datos. Con un secreto del servidor, `LOGIN_CODE_PEPPER`, se convierte en una contraseña larga (`HMAC-SHA256(secreto, email + código)`), y esa es la contraseña del usuario en Supabase.
- Al escribir un código, la acción del servidor calcula esa contraseña y prueba `signInWithPassword`. Si no vale y el código tiene 6 cifras, prueba el código del correo, como antes.
- En la pantalla de acceso aparece el botón «Tengo un código fijo», que pasa a escribir el código **sin pedir ningún correo**. Solo se ve si el servidor tiene `LOGIN_CODE_PEPPER`; sin él, todo funciona como antes.
- El código se pone, se cambia o se quita con `pnpm auth:set-code <código>` (o `--off`), que cambia la contraseña con la clave *secret* del proyecto desde `.env.pipeline`.
- El acceso por correo sigue funcionando igual: es la vía de recuperación si se olvida el código.
- El email permitido se sigue comprobando antes de todo y en cada petición.

## Alternativas consideradas

- **Comparar el código con una variable de entorno.** Seguiría haciendo falta una contraseña de Supabase para abrir la sesión, y serían dos secretos que mantener en vez de uno.
- **Escribir el código en el repositorio.** El repositorio es público.
- **Una contraseña normal.** Es lo que es, con otro nombre: se limita a cifras porque así se pidió. Con el mismo mecanismo se podría admitir texto.
- **Un SMTP propio** para que el correo traiga el código de un solo uso. Es más seguro (cada código vale una vez) y sigue siendo lo recomendable; no quita la dependencia del correo, que es lo que se quería evitar.

## Consecuencias

- **La seguridad del acceso pasa a ser la del código.** El email no es un secreto (está en los *commits* del repositorio público), así que quien lo sepa solo necesita acertar el código. Un código corto u obvio (`123456`, `000000`, una fecha) equivale a no tener protección.
- **Qué podría hacer quien entrara:** ver y cambiar el progreso, y gastar correcciones de writing con IA hasta los límites de la app (`AI_DAILY_LIMIT` al día y `AI_MONTHLY_BUDGET_USD` al mes). No puede ver la clave de Anthropic ni llegar a otros servicios.
- **Lo que frena un ataque por fuerza bruta** es el límite de Supabase a los intentos de inicio de sesión por IP (`sign_in_sign_ups`, que se baja a 10 cada cinco minutos) y que, sin el secreto, no se pueden probar códigos directamente contra Supabase: hay que pasar por el servidor de la app. Con ocho cifras no obvias eso son años; con un código que cualquiera probaría primero, no sirve de nada.
- Si se filtra `LOGIN_CODE_PEPPER`, hay que cambiarlo en Vercel y en `.env.pipeline` y volver a ejecutar `pnpm auth:set-code`.
- Los tests e2e llevan el código fijo activado con un secreto de pruebas; el emulador deriva la misma contraseña y acepta `grant_type=password`.
