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

Es, junto con el titular que se escribe (abajo), la única excepción a MASTER §6 (movimiento) en toda la web. La portada empieza con una escena
de una sala de estudio de noche: ventana, flexo, libros y un portátil sobre la mesa. Al hacer
scroll, la escena se acerca a la pantalla del portátil hasta que esta ocupa la ventana y se
cambia por «Crea tu plan» (abajo), un formulario de verdad.

- **Cómo funciona:** con el acercamiento puesto (`.is-ready`), `.zoom-hero` mide 320vh y dentro
  hay un escenario fijo de 100vh con el titular encima. `app.js` escala la escena hacia el centro
  de la pantalla del portátil (escala geométrica, que se siente como una cámara a velocidad
  constante). Dentro del portátil va una copia de «Crea tu plan» del tamaño de la ventana,
  encogida; cuando la escala la deja a tamaño real se cambia por `.zoom-app`, que es la pantalla
  de verdad. El titular se desvanece en el primer 20 % del recorrido.
- **Solo si cabe:** el portátil tiene que verse entero debajo de los botones del titular. Si la
  ventana es baja, `app.js` lo encoge (`--fit`); si habría que encogerlo demasiado (un móvil en
  horizontal, por ejemplo), no hay acercamiento y la portada se queda quieta, como abajo. Nada
  se monta sobre el titular ni se recorta.
- **La copia del portátil** la hace `app.js` a partir de `.zoom-app`: sin `id` ni `name` (no
  pueden repetirse) y dentro de `.zoom-mini`, que es `inert`. Muestra el primer paso.
- **En vertical** (móvil o tablet de pie) la escena se acerca a un móvil, no a un portátil. La
  pantalla del aparato toma siempre la forma de la ventana para que la app no se recorte. En el
  móvil, la mesa sube lo que mide la barra del navegador (`100lvh - 100svh`) para que no la tape.
- **Color:** escena monocroma hecha con los tokens de siempre, oscurecidos con negro donde hace
  falta noche (la pared, el cristal, la tapa del portátil); el único color es un brillo cobalto
  detrás del portátil, hecho con un degradado (no es una sombra).
- **CSP:** sin `style="…"` en el HTML. `app.js` solo toca propiedades del CSSOM, que la CSP admite.
- **Movimiento reducido, sin JavaScript o si no cabe:** la portada se queda quieta, con el titular
  y, debajo, la escena. Mide una pantalla si cabe; si no, sigue hacia abajo.

## Pantalla final: «Crea tu plan»

Lo que aparece al terminar el acercamiento. Lo pidió el dueño al ampliar Señal a cinco idiomas
(ADR-0032): quien llega elige qué idioma quiere aprender y, más adelante, entrará en la zona de
estudio de ese idioma, con sus tareas y su examen.

- **Cuatro preguntas, una por paso:** el idioma (cada uno con su nombre en su idioma y su examen
  oficial: Cambridge, DELE, DELF, HSK, JLPT), el nivel (de «Empiezo de cero» a «Casi como un
  nativo», o «No lo sé»), para qué (viajar, trabajo, estudios, aprobar el examen oficial —que dice
  cuál según el idioma— o por gusto) y cuántos minutos al día. Después, «Tu plan»: el resumen.
- **Por ahora no se guarda nada.** El resumen lleva a entrar en Señal (`/login`). Para cualquier
  idioma que no sea el inglés dice que sus lecciones están en preparación. Cuando exista la zona de
  estudio de cada idioma, llevará allí.
- **Opciones:** tarjetas en `surface-2` con la radio invisible encima (se pulsa toda la tarjeta y
  funciona con las flechas). La elegida, con borde cobalto y el nombre en `accent-text`. Una sola
  acción cobalto por paso: «Siguiente», «Ver mi plan» o «Empezar a estudiar».
- **Accesible:** es un `<form>` con nombre y un `<fieldset>` por pregunta. «Paso 2 de 4» se
  anuncia (`aria-live`), el error («Elige una opción para seguir.») es un `role="alert"` y, al
  cambiar de paso, el foco va a la respuesta elegida o a la primera.
- **Con el acercamiento,** mientras no se ve no se puede tocar con el ratón (`pointer-events`),
  pero sí llegar con el teclado o un lector de pantalla: al recibir el foco, `app.js` avanza el
  recorrido hasta que se ve. **Sin acercamiento** va en su sitio, debajo de la escena. **Sin
  JavaScript** se ven las cuatro preguntas seguidas y el botón envía a `/login`.
- **Cabe en una pantalla:** cada paso cabe en el móvil; si no cupiera, `.zoom-app` tiene su propio
  scroll.

## Titular: la palabra que se escribe

La palabra del titular («Domina el **Inglés** con Señal») se escribe y se borra, un idioma tras
otro: Inglés, Español, Francés, Chino, Japonés y vuelta a empezar. Es la otra excepción a MASTER §6;
la pidió el dueño al ampliar Señal a cinco idiomas (ADR-0032).

- **Ritmo:** cada palabra se escribe en 1 s (del hueco a entera), se queda 1,5 s entera y quieta
  y se borra en 1 s (de la primera letra que se va al hueco), sea larga o corta: el tiempo por letra
  sale de su longitud. Una vuelta entera, unos 17 s. Empieza con «Inglés» ya escrito, como en el
  HTML. (Al principio eran 2–3 s escribiendo y 5 s quieta; al verla publicada, el dueño pidió estos
  tiempos.)
- **Cursor:** una barra fina de cobalto (`accent`), quieta: no parpadea. Solo aparece con la
  animación en marcha.
- **Sin saltos:** `app.js` mide el titular con cada palabra y le da el alto de la que más ocupa.
  Así no cambia de líneas al escribirse ni mueve lo de abajo, y el acercamiento al portátil, que
  mide el titular, cuenta con su alto definitivo. Por eso este bloque va antes que el del
  acercamiento. En el móvil, con una palabra corta, queda una línea libre debajo.
- **Lectores de pantalla:** leen siempre «Domina el Inglés con Señal». La palabra animada va con
  `aria-hidden` y la fija, con `.sr-only`.
- **Movimiento reducido o sin JavaScript:** «Inglés», quieto y sin cursor.
- **Pendiente de decidir:** la animación no se detiene sola. WCAG 2.2.2 pide poder pausar lo que se
  mueve más de 5 s; se puede cumplir con un botón de pausa o parando tras una vuelta.

## Fotografías

Las fotos se conservan. Van siempre dentro de una caja de 12 px de radio, nunca como fondo de un
texto. La del escritorio, que acompañaba al titular, acompaña ahora a «Flexibilidad y Éxito»: su
sitio en la portada lo ocupa la escena del hero.

## Cabecera y pie

La cabecera es la de la app: translúcida al hacer scroll, enlaces en píldora y el activo en
`surface-2` con `accent-text`. Por debajo de 1.024 px los enlaces se abren con un botón de menú.
El pie se separa con una línea en `surface-2`.
