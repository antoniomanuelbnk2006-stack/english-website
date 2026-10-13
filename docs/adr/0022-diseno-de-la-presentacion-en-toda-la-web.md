# ADR-0022 · El diseño de la presentación, en toda la web

- **Estado:** Aceptada en lo que toca a la portada pública; su lenguaje visual (pastillas verdes, esquinas grandes, entradas animadas) lo sustituye [ADR-0027](0027-sistema-de-diseno-master.md)
- **Fecha:** 2026-10-11

## Contexto

El dueño tenía una página de presentación de Señal en Wix. Pidió llevar su estructura y sus animaciones a nuestra web con los estilos de la app, y después, al ver que la web de estudio no cambiaba, que **«se vea en la web el nuevo diseño»**.

## Decisión

1. **La portada es la presentación.** `public/landing/` (tres páginas estáticas: inicio, nosotros, contacto) se sirve fuera del acceso con código y sin datos. Quien no ha entrado y abre `/` la ve (el proxy la sirve con una *rewrite*, sin cambiar la dirección); quien ya tiene sesión sigue yendo a `/hoy`. Desde su cabecera se llega a `/login`.
   - La portada va **sin la CSP de la app**: es HTML estático con la fuente de Google y las fotos alojadas en Wix, y la CSP con *nonce* le bloquearía su propio script. El resto de la web conserva la CSP.
2. **El lenguaje visual de la presentación pasa a los componentes de la app** (`globals.css`, `button.tsx`, `panel.tsx`, `page.tsx`), sin tocar las pantallas una a una:
   - Botones en **pastilla**; al pasar el ratón se subrayan y suben 2 px.
   - Paneles con **esquinas de 24 px** (antes 14).
   - Título de cada pantalla con **entrada «Tilt In»** al cargar.
   - Paneles con **entrada «Arc In»** ligada al scroll (`animation-timeline: view()`); sin soporte del navegador no se animan.
   - Todo se desactiva con `prefers-reduced-motion`.
3. Los colores y la tipografía **no cambian**: son los de la app.

## Alternativas consideradas

- **Dejar la presentación aparte** (solo en `/landing`): no se nota al abrir la web, que era la queja.
- **Pasar la web de estudio a los colores crema y verde de Wix:** cambiaría la identidad de toda la app y los cuatro temas (oscuro, claro, sistema, papel); no se pidió.
- **Reescribir cada pantalla:** mucho cambio y riesgo en 150 pruebas e2e para un efecto que consiguen los componentes base.

## Consecuencias

- Todos los botones y paneles de la app cambian de forma de una vez. Los botones con icono de 44 px quedan circulares.
- La entrada de los paneles solo se ve en navegadores con *scroll-driven animations* (Chrome, Edge, Safari reciente); en Firefox y derivados la web queda igual que antes, sin animación.
- La portada pública no pide código: no contiene datos y los enlaces de contacto son los de relleno de Wix.
- Las fotos de la presentación se cargan de los servidores de Wix; si se borra ese sitio, hay que alojarlas en el repositorio.
