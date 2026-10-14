# ADR-0033 · Tema personalizado con CSS propio

- **Estado:** Aceptada
- **Fecha:** 2026-10-14

## Contexto

El dueño preguntó si Señal podía tener algo como Vencord: que cada uno cambie el diseño de toda la web con su propio archivo CSS. La app ya tiene tres temas (oscuro, claro y según el sistema) y todos sus colores salen de unas pocas variables CSS (`--canvas`, `--surface`, `--accent`…), así que un CSS que cambie esas variables cambia toda la app sin tocar nada más.

## Decisión

1. **Ajustes tiene un apartado «Tema personalizado»** (`/ajustes#tema`): se sube un archivo `.css` o se escribe en un campo, se puede partir de tres ejemplos (Sepia, Alto contraste y Neón), probarlo sin guardar, guardarlo y quitarlo. Una guía plegable explica las variables.
2. **Se guarda en el perfil**, en `profiles.settings.custom_css`: sigue a la persona en cualquier dispositivo y no hace falta migración. Guardar los demás ajustes conserva esa clave.
3. **Lo pinta el servidor**, en el layout raíz, como un `<style data-custom-theme>` al final del `<body>`: va después de la hoja de la app, así que manda con la misma especificidad, y no hay parpadeo del diseño de siempre al cargar. Solo con sesión: el acceso sin entrar y la presentación (`public/landing`) no cambian.
4. **Solo CSS, y nada de fuera.** `checkThemeCss` (en el navegador y otra vez en el servidor) rechaza:
   - más de 50.000 caracteres;
   - cualquier `<`, para que el CSS no pueda cerrar la etiqueta `<style>` y meter HTML;
   - `@import`, y las barras invertidas tras `@` con las que se podría disfrazar;
   - `javascript:`, `expression(`, `-moz-binding` y `behavior:`, restos de navegadores viejos que ejecutaban código desde CSS.

   Además, la CSP de la app ya impide cargar nada de otro sitio (`img-src 'self' data: blob:`, `font-src 'self'`): un `url()` a otra web no se descarga, así que un tema tampoco puede filtrar lo que hay en la página con selectores de atributos.
5. **Modo seguro: `?sin-tema`.** Con ese parámetro en cualquier página, el tema guardado no se aplica (`src/proxy.ts` lo pasa como cabecera interna, `x-senal-sin-tema`, que se borra si viene de fuera). El apartado enseña la dirección `/ajustes?sin-tema` por si un tema deja la app inservible, y en esa página avisa de que hay uno guardado sin aplicar.
6. **Las variables son lo estable; las clases, no.** La guía anima a cambiar variables. Quien toque clases (`.card`, `.btn`…) sabe que pueden cambiar con un rediseño.

## Alternativas consideradas

- **Plugins con JavaScript, como Vencord.** Un plugin puede hacer cualquier cosa con la cuenta: leer el correo, borrar el progreso, mandar datos fuera. Sin una tienda revisada no es seguro, y la CSP con nonce lo impediría de todas formas.
- **Cargar el tema desde una dirección** (`<link href="https://…">`). Obligaría a abrir la CSP a cualquier sitio, y el tema podría cambiar sin que la persona lo sepa.
- **Guardarlo solo en el navegador** (`localStorage`). No seguiría a la persona entre dispositivos, se pintaría tarde (después del diseño de siempre) y habría que tratarlo como preferencia en el aviso de cookies ([ADR-0028](0028-consentimiento-de-cookies.md)).
- **Un editor visual de colores.** Más cómodo para cambiar el acento, pero no permite lo que pidió el dueño: cambiar el diseño entero con un archivo. Puede venir encima de esto.

## Consecuencias

- Es CSS que solo ve quien lo escribe, en su propia sesión. Lo peor que puede hacer es dejarse la app ilegible, y para eso está el modo seguro.
- La política de privacidad dice que los ajustes incluyen el CSS del tema.
- Cada página con sesión hace una consulta más a `profiles` (una por petición, con `cache`).
- `tests/e2e/tema.spec.ts` prueba el ciclo entero (probar, guardar, verlo en Hoy, conservarlo al guardar otros ajustes, modo seguro, quitarlo), la subida de un archivo y el rechazo de `<` y `@import`; `src/features/theme/lib/custom-css.test.ts`, la comprobación.
