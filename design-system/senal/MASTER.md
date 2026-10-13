# Señal — Design System (MASTER)

> Fuente de verdad visual y de UX de Señal, la web personal para aprender inglés de A1 a C2.
> Estética: la referencia "Mercury" (reference/mercury-DESIGN.md) adaptada a una app de estudio.
> Reglas de UX: seleccionadas de UI UX Pro Max (ux-guidelines + stack nextjs) y fusionadas aquí.

**Prioridad:** `pages/<pantalla>.md` > este MASTER > reference/mercury-DESIGN.md > recomendaciones genéricas de UI UX Pro Max.
**Implementación:** todos los tokens y clases viven en `src/styles/globals.css`. No escribas colores hex sueltos en componentes.

---

## 1. Personalidad

Silenciosa, premium, concentrada. Una sala de estudio de noche, no un juego infantil.
Oscuro y monocromo, con **un único acento cobalto**. La tipografía hace el trabajo expresivo;
los componentes son planos, sin sombras, con controles en forma de píldora.

Señal **no** es Duolingo: nada de mascotas, claymorphism, colores chillones, confeti ni emojis como iconos.
La motivación viene de la claridad del progreso, no de la decoración.

---

## 2. Color

| Token Tailwind | Valor | Uso |
|---|---|---|
| `canvas` | `#171721` | Fondo de página (nivel 0) |
| `surface` | `#1e1e2a` | Tarjetas, paneles (nivel 1) |
| `surface-2` | `#272735` | Botón secundario, input relleno, tags, pista de progreso (nivel 2) |
| `border` | `#70707d` | Divisores, hover de opciones |
| `border-soft` | `#e2e3ed` | Bordes finos, ghost buttons, inputs |
| `text` | `#ededf3` | Texto principal. Nunca `#fff` en cuerpo |
| `muted` | `#c3c3cc` | Texto secundario, ayudas, placeholders |
| `accent` | `#5266eb` | **Relleno** del botón principal, barra de progreso, foco |
| `accent-text` | `#8b98ff` | Cobalto **como texto**: enlaces, nav activo, palabra resaltada |
| `on-accent` | `#ffffff` | Texto sobre cobalto |
| `success` / `error` / `warning` | `#6cbf95` / `#e07575` / `#d8ad5a` | Solo feedback de ejercicios |

**Reglas**
- Una sola acción cobalto rellena por pantalla ("Comprobar", "Siguiente", "Empezar sesión").
- `accent` no sirve como color de texto: sobre el fondo da 3,5–3,8:1 y suspende WCAG. Para texto usa `accent-text` (6,3:1).
- `success/error/warning` solo como borde, icono, texto o fondo al 12 %. Nunca como botón relleno ni como fondo de sección.
- El significado nunca depende solo del color: acierto/error siempre llevan icono + texto ("Correcto", "Casi: era *went*").

**Contrastes verificados:** texto/canvas 15:1 · muted/surface 9,4:1 · blanco/cobalto 4,7:1 · success/surface 7,5:1 · error/surface 5,5:1 · warning/surface 7,9:1.

---

## 3. Tipografía

- **Cuerpo/UI:** Inter (variable), sustituto de *arcadia*. Pesos 360 / 400 / 420 / 480.
- **Titulares:** Archivo con `font-stretch: 112%`, sustituto de *Söhne Breit*. Peso **480** (530 solo en display).
- Cargadas con `next/font` (variables, sin layout shift). Nunca `<link>` a Google Fonts.

| Clase | Tamaño | Interlineado | Uso |
|---|---|---|---|
| `text-caption` | 12px | 1.33 | Metadatos, nivel CEFR, contadores |
| `text-body-sm` | 14px | 1.4 | Ayudas, etiquetas |
| `text-body` | 16px | 1.5 | Texto base de UI |
| `text-body-lg` | 18px | 1.5 | Enunciados de ejercicio |
| `text-subheading` | 21px | 1.35 | Subtítulos de tarjeta |
| `text-heading-sm` | 28px | 1.2 | Título de tarjeta grande |
| `text-heading` | 32px | 1.15 | Título de pantalla |
| `text-heading-lg` | 32→42px | 1.15 | Título de sección |
| `text-display` | 40→65px | 1.1 | Solo bienvenida / resultado de sesión |

**Reglas**
- Titulares nunca por encima de 530. Nada de `font-bold`.
- Texto largo en inglés (reading, writing): clase `.prose-reading`, 18–19px, interlineado 1.7, máx. 68 caracteres por línea.
- `text-wrap: balance` en titulares es una mejora, no una garantía: el diseño debe aguantar cualquier salto de línea.

---

## 4. Espacio, forma y layout

- Escala de Tailwind por defecto (base 4px). Equivalencias: 12px = `3`, 32px = `8`, 72px = `18`.
- **Radios:** tarjeta 12px (`rounded-card`), controles 32px (`rounded-pill`), nav/tags 40px (`rounded-nav`), estructura 4px.
- **Sin sombras.** La elevación sale del salto canvas → surface → surface-2.
- Contenedor de página 1200px. Pantallas de ejercicio: columna centrada de **680px**.
- Ritmo: 72px entre secciones en páginas de navegación; 24–32px dentro de una sesión de estudio.
- Responsive comprobado en 375 / 768 / 1024 / 1440px. Gutter lateral de 16px en móvil.

---

## 5. Componentes (clases en globals.css)

| Clase | Qué es |
|---|---|
| `.card` | Superficie de contenido: surface, 12px, padding 32px (24px en móvil) |
| `.btn` + `.btn-primary` | Acción principal, cobalto. Una por pantalla |
| `.btn` + `.btn-secondary` | Acción secundaria rellena en surface-2 |
| `.btn` + `.btn-ghost` | Acción terciaria con borde ivory |
| `.btn-icon` | Botón solo icono, 44×44, con `aria-label` obligatorio |
| `.input` / `textarea.input` | Píldora / caja de 12px para writings |
| `.option` | Respuesta de test. Estados: `aria-pressed`, `data-state="correct|wrong"` |
| `.feedback` | Banda de corrección bajo el ejercicio (`data-tone="success|error"`) |
| `.progress` | Barra de progreso de sesión con `role="progressbar"` |
| `.tag` | Nivel CEFR, destreza, tema |
| `.nav-link` | Enlace de navegación; activo con `aria-current="page"` |
| `.skeleton` | Placeholder de carga estable |
| `.prose-reading` | Texto largo de lectura |
| `.section` | Contenedor de 1200px con 72px de ritmo vertical |

**Iconos:** Lucide o Phosphor en trazo fino, color `text`/`muted`, 20px. Decorativos con `aria-hidden="true"`. Nunca emojis como iconos.

---

## 6. Movimiento

- Transiciones de 150–200ms solo en color, borde y opacidad. Nada de rebotes.
- La barra de progreso anima su ancho en 300ms.
- `prefers-reduced-motion` desactiva todas las transiciones (ya en globals.css).
- Si el usuario pulsa rápido, el estado final (selección, foco, contenido) debe ser correcto aunque la animación se corte.

---

## 7. Reglas de UX (de UI UX Pro Max, aplicadas a Señal)

**Accesibilidad**
- Contraste mínimo 4,5:1 en texto normal y 3:1 en texto grande y focos.
- Foco visible en todo control: `outline 2px` cobalto con offset 2px. Nunca `outline-none` sin alternativa.
- Objetivos táctiles de 44px de alto en botones y opciones (mínimo WCAG 24px; usamos 44 por comodidad en móvil).
- 8px mínimo entre objetivos táctiles adyacentes.

**Feedback**
- Toda acción responde: cargando → resultado. El botón "Comprobar" pasa a "Comprobando…" y se deshabilita mientras la IA corrige.
- Correcciones y errores con `role="status"` (feedback de ejercicio) o `role="alert"` (error de envío), nunca solo con borde rojo.
- Progreso visible en sesiones: "Pregunta 3 de 10" + `.progress`.
- Carga: `.skeleton` con el mismo tamaño que el contenido final y `aria-busy="true"` en el contenedor. Sin spinners parpadeantes para esperas cortas.
- Reserva espacio para la banda de feedback para que el contenido no salte al aparecer.

**Formularios**
- Errores inline bajo el campo con `aria-describedby`; si el envío falla, resumen arriba con foco movido a él.
- Etiquetas visibles (no solo placeholder).

**Contenido**
- Estados vacíos con mensaje y acción: "Aún no hay writings. Escribe el primero".
- Líneas de lectura de 65–75 caracteres.
- Audio: nunca autoplay; controles de play/pausa, velocidad y transcripción.
- La URL refleja el estado: `/practicar/listening/b1/12`.

**Next.js**
- Server Components por defecto; `'use client'` solo en hojas interactivas (opciones, reproductor, editor).
- Fuentes con `next/font`; metadata con `export const metadata` / `generateMetadata`.
- Imágenes con `next/image`; `priority` solo en la imagen above-the-fold.

---

## 8. Prohibido

- Segundo color de acento, degradados morados/rosas, fondos de sección de color.
- Sombras, glassmorphism fuera de la nav con scroll, claymorphism.
- `font-bold` / 700+, esquinas rectas en controles.
- Dos botones cobalto juntos (separación mínima 32px si de verdad hacen falta).
- Emojis como iconos, mascotas, confeti, sonidos automáticos.
- Fuentes infantiles (Baloo, Comic Neue) o recomendaciones de estilo que genere `--design-system`.

---

## 9. Checklist antes de entregar una pantalla

- [ ] Solo hay una acción cobalto rellena
- [ ] Ningún hex suelto: todo sale de tokens/clases de globals.css
- [ ] Contraste ≥ 4,5:1 en texto; cobalto como texto usa `accent-text`
- [ ] Foco visible navegando con teclado
- [ ] Feedback con icono + texto, anunciado con `role`
- [ ] Estado de carga, vacío y error diseñados
- [ ] Sin saltos de layout al aparecer feedback o cargar datos
- [ ] Probado en 375, 768, 1024 y 1440px
- [ ] `prefers-reduced-motion` respetado
- [ ] `'use client'` solo donde hace falta
