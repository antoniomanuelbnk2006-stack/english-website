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

## Hero: acercamiento al portátil

Es la única excepción a MASTER §6 (movimiento) en toda la web. La portada empieza con una escena
de una sala de estudio de noche: ventana, flexo, libros y un portátil sobre la mesa. Al hacer
scroll, la escena se acerca a la pantalla del portátil hasta que esta ocupa la ventana y se
cambia por la pantalla «Hoy» de la app.

- **Cómo funciona:** con el acercamiento puesto (`.is-ready`), `.zoom-hero` mide 320vh y dentro
  hay un escenario fijo de 100vh con el titular encima. `app.js` escala la escena hacia el centro
  de la pantalla del portátil (escala geométrica, que se siente como una cámara a velocidad
  constante). Dentro del portátil va una copia de «Hoy» del tamaño de la ventana, encogida;
  cuando la escala la deja a tamaño real se cambia por `.zoom-app`, que es la misma pantalla
  nítida. El titular se desvanece en el primer 20 % del recorrido.
- **Solo si cabe:** el portátil tiene que verse entero debajo de los botones del titular. Si la
  ventana es baja, `app.js` lo encoge (`--fit`); si habría que encogerlo demasiado (un móvil en
  horizontal, por ejemplo), no hay acercamiento y la portada se queda quieta, como abajo. Nada
  se monta sobre el titular ni se recorta.
- **La pantalla «Hoy»** es una imagen de la app hecha con HTML (`#pantalla-hoy`): `aria-hidden`
  e `inert`, sin enlaces. Si cambia «Hoy» en la app, actualiza la copia.
- **En vertical** (móvil o tablet de pie) la escena se acerca a un móvil, no a un portátil. La
  pantalla del aparato toma siempre la forma de la ventana para que la app no se recorte. En el
  móvil, la mesa sube lo que mide la barra del navegador (`100lvh - 100svh`) para que no la tape.
- **Color:** escena monocroma hecha con los tokens de siempre, oscurecidos con negro donde hace
  falta noche (la pared, el cristal, la tapa del portátil); el único color es un brillo cobalto
  detrás del portátil, hecho con un degradado (no es una sombra).
- **CSP:** sin `style="…"` en el HTML. `app.js` solo toca propiedades del CSSOM, que la CSP admite.
- **Movimiento reducido, sin JavaScript o si no cabe:** la portada se queda quieta, con el titular
  y, debajo, la escena. Mide una pantalla si cabe; si no, sigue hacia abajo.

## Fotografías

Las fotos se conservan. Van siempre dentro de una caja de 12 px de radio, nunca como fondo de un
texto. La del escritorio, que acompañaba al titular, acompaña ahora a «Flexibilidad y Éxito»: su
sitio en la portada lo ocupa la escena del hero.

## Cabecera y pie

La cabecera es la de la app: translúcida al hacer scroll, enlaces en píldora y el activo en
`surface-2` con `accent-text`. Por debajo de 1.024 px los enlaces se abren con un botón de menú.
El pie se separa con una línea en `surface-2`.
