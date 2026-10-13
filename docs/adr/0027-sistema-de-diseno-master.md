# ADR-0027 · Sistema de diseño «MASTER»: oscuro, monocromo y un único acento cobalto

- **Estado:** Aceptada (sustituye a [ADR-0023](0023-paleta-y-tipografia-de-la-presentacion.md) y al lenguaje visual de [ADR-0022](0022-diseno-de-la-presentacion-en-toda-la-web.md); la portada pública que creó ADR-0022 sigue)
- **Fecha:** 2026-10-13

## Contexto

El dueño entregó un sistema de diseño completo, `MASTER.md`, y pidió llevarlo a toda la web **sin quitar ni añadir nada**: solo cambia el aspecto. La web venía de la paleta crema, azul marino y verde de la presentación (ADR-0023), con Fraunces, entradas animadas y un tema claro por defecto.

## Decisión

- **Una sola fuente de verdad visual:** [`design-system/senal/MASTER.md`](../../design-system/senal/MASTER.md). Su implementación es `src/styles/globals.css` (tokens y clases de componente) y lo que una pantalla necesite distinto va en `design-system/senal/pages/<pantalla>.md`.
- **Lo que trae MASTER, tal cual:** paleta oscura (`canvas` → `surface` → `surface-2`) con un único acento cobalto, que se distingue en relleno (`accent`) y texto (`accent-text`); Inter para el cuerpo y Archivo ensanchado al 112 % para los titulares; tarjetas de 12 px y controles en píldora; sin sombras; transiciones solo de color, borde y opacidad. El tema por defecto pasa a ser el oscuro (`DEFAULT_THEME = 'dark'`).

Lo que MASTER no decide y se ha decidido aquí:

1. **Los temas claro, «según el sistema» y «papel» se conservan**, porque Ajustes ya los ofrecía y no había que quitar nada. Son el mismo sistema (mismo cobalto, misma tipografía, mismas formas) con los niveles invertidos, y cumplen los mismos contrastes (`src/styles/contrast.test.ts`).
2. **La portada pública (`public/landing`) usa el mismo sistema.** Es HTML estático y no pasa por Tailwind, así que repite los tokens en su hoja de estilos (un test comprueba que coinciden con los del tema oscuro) y sirve las mismas Inter y Archivo desde `/landing/fonts`, sin `<link>` a Google Fonts. Su CSP queda más estricta: sin orígenes de fuentes y sin `'unsafe-inline'`.
3. **Cifras y lectura larga van en Inter**: las cifras con `tabular-nums` y los textos con `.prose-reading`. Desaparecen Fraunces, Wix Madefor Text, Geist Mono y Literata.
4. **Fuera las animaciones de entrada** y el botón que subía al pasar el ratón (MASTER §6).
5. **Una sola acción cobalto por pantalla**, llevada a los casos dudosos: el botón de reproducir es secundario (el cobalto lo lleva la onda), una lista de acciones iguales —los simulacros de un examen— usa el secundario, y las capas flotantes en `surface-2` (la glosa de una palabra) usan botones con borde, porque el secundario se confundiría con su fondo.
6. **Dos contenedores** (`PageContainer`): `page`, de 1.200 px, y `exercise`, la columna centrada de 680 px. Las secciones de una página de navegación se apilan con `PageSections` (72 px).
7. **La API de `Button` no cambia**: sus variantes se traducen a las clases de MASTER (`outline` → secundario, `ghost` → terciario con borde, `danger` → terciario en color de error).

## Alternativas consideradas

- **Quitar los temas claro y papel**, que MASTER no contempla. Descartado: el dueño pidió no quitar nada, y el papel tiene su función al leer textos largos.
- **Dejar la portada con su diseño anterior.** La web tendría dos estéticas, y la portada seguiría cargando fuentes de Google, que MASTER prohíbe.
- **Cargar en la portada las fuentes que `next/font` genera para la app.** Sus nombres cambian en cada compilación; copiar el subconjunto latino a `public/landing/fonts` es estable.

## Consecuencias

- Quien no tuviera un tema guardado pasa a ver la web oscura; quien eligió el claro lo sigue viendo, ahora con la paleta derivada.
- `docs/03-producto/05-sistema-de-diseno.md` deja de definir tokens y remite a MASTER; conserva lo que MASTER no cubre (componentes propios, accesibilidad, microcopy).
- Las pruebas de contraste se reescriben para los tokens nuevos y cubren también el color de corrección sobre su propio fondo al 12 %.
- Un token que cambie en `globals.css` hay que cambiarlo también en `public/landing/styles.css`; el test de contraste falla si se olvida.
