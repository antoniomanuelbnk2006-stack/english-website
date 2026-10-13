# Portada pública — lo que se aparta de MASTER

Rutas: `/` sin sesión y `/landing/*` (`public/landing`). Solo lo que cambia respecto a
[MASTER](../MASTER.md).

## Implementación

Son tres páginas de HTML estático: no pasan por Tailwind ni por `next/font`.

- **Tokens:** `public/landing/styles.css` repite los del tema oscuro de `src/styles/globals.css`.
  Un test (`src/styles/contrast.test.ts`) falla si dejan de coincidir.
- **Fuentes:** las mismas Inter y Archivo, servidas desde `/landing/fonts` (subconjunto latino).
  Ningún `<link>` a Google Fonts.
- **Sin estilos en el HTML:** nada de `style="…"`; la CSP de estas páginas no los admite.

## Tipografía

Es la única parte de la web que usa `display` (el titular de la portada) y `heading-lg` (los
títulos de sección), como prevé la tabla de MASTER §3.

## Acción cobalto

Una por pantalla: «Regístrate Ahora» arriba y «Empieza Ahora» en el cierre. Son la misma acción
y nunca se ven a la vez (las separa toda la página). «Entrar», «Saber Más», «Explorar…» y
«Abrir…» son terciarios o secundarios.

## Fotografías

Las fotos se conservan. Van siempre dentro de una caja de 12 px de radio, nunca como fondo de un
texto: el titular ya no va sobre la foto, sino a su lado.

## Cabecera y pie

La cabecera es la de la app: translúcida al hacer scroll, enlaces en píldora y el activo en
`surface-2` con `accent-text`. Por debajo de 1.024 px los enlaces se abren con un botón de menú.
El pie se separa con una línea en `surface-2`.
