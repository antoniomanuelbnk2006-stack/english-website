# Sistema de diseño

> **Propósito:** cómo se aplica el diseño en Señal y lo que la fuente de verdad no cubre: componentes propios, accesibilidad y microcopy.
> **Relacionado:** [Pantallas](02-pantallas-y-flujos.md) · [PWA, rendimiento y accesibilidad](../04-arquitectura/08-pwa-rendimiento-accesibilidad.md)

> **La fuente de verdad visual es [`design-system/senal/MASTER.md`](../../design-system/senal/MASTER.md)** ([ADR-0027](../adr/0027-sistema-de-diseno-master.md)). Color, tipografía, espacio, forma, clases de componente, movimiento y reglas de UX se deciden allí; este documento no los repite. Lo que una pantalla necesite distinto está en `design-system/senal/pages/`.

---

## 1. Concepto

**«Del ruido a la señal.»** Una sala de estudio de noche: silenciosa, concentrada, sin decoración. La interfaz es oscura y monocroma, con un único acento cobalto; la tipografía hace el trabajo expresivo y la motivación sale de ver el progreso con claridad (MASTER §1).

De la idea original se conservan dos motivos, porque informan: la **forma de onda** del audio y las **barras de señal** del nivel.

---

## 2. Tokens

Los de MASTER §2, implementados en `src/styles/globals.css` como variables CSS que Tailwind v4 expone con `@theme inline`. La paleta por defecto de Tailwind está desactivada: solo existen los colores de MASTER.

- En componentes, solo clases semánticas (`bg-surface`, `text-muted`, `border-border`). **Nunca hex sueltos.**
- El cobalto tiene dos tokens: `accent` es **relleno** (botón principal, progreso, foco) y `accent-text`, cobalto **como texto**.
- El tema se aplica con `data-theme` en `<html>`. Por defecto, oscuro; Ajustes deja elegir claro o «según el sistema», y un fondo de papel para el lector. Sus paletas son derivadas y están en [`pages/ajustes.md`](../../design-system/senal/pages/ajustes.md).
- `src/styles/contrast.test.ts` falla si un cambio de token baja de los contrastes de MASTER en cualquiera de los temas, o si la portada (`public/landing/styles.css`) deja de usar los mismos colores.

---

## 3. Tipografía

La de MASTER §3: **Inter** para el cuerpo y **Archivo** (ensanchada al 112 %) para los titulares, cargadas con `next/font` en `src/app/layout.tsx`. La escala (`text-caption` … `text-display`) es la única que existe: los tamaños por defecto de Tailwind están desactivados.

- Texto largo en inglés (lector, transcripción, enunciados): `.prose-reading`, sin partición de palabras, porque tienen que verse completas para tocarlas.
- Cifras, tiempos y contadores: `tabular-nums`.
- El tamaño de letra del lector se ajusta en Ajustes (16–24 px) sin romper el diseño.

---

## 4. Espaciado, forma y elevación

Los de MASTER §4. En el código:

- `PageContainer` (`src/components/ui/page.tsx`) da los dos anchos: `page` (1.200 px) y `exercise` (columna centrada de 680 px).
- `PageSections` apila las secciones de una página de navegación a 72 px.
- Sin sombras: la elevación es el salto `canvas` → `surface` → `surface-2`. Lo que va sobre `surface-2` (una capa flotante, un bloque dentro de una tarjeta) usa botones con borde, no el secundario.

---

## 5. Iconografía y motivos

- Iconos: **lucide-react**, trazo fino, 20 px en la interfaz, con `aria-hidden` si son decorativos.
- **Forma de onda** (picos precalculados del audio, ver [modelo de contenido](../04-arquitectura/04-modelo-de-contenido.md)): se rellena de cobalto hasta la posición actual. Es una barra de progreso.
- **Barras de señal** para el nivel (ver [gamificación §4](04-gamificacion.md#4-barras-de-señal-el-nivel)).

---

## 6. Componentes

Las clases de MASTER §5 (`.card`, `.btn`, `.input`, `.option`, `.feedback`, `.progress`, `.tag`, `.nav-link`…) están en `globals.css`. Encima van los componentes de `src/components/ui/` (`Button`, `Panel`, `Chip`, `Input`, `PageHeader`, `EmptyState`…) y, con Radix para el comportamiento, los propios:

| Componente | Responsabilidad | Notas de diseño |
|---|---|---|
| `SignalBars` | Nivel por destreza (6 barras + relleno parcial) | `aria-label="Listening: B1, 63 % hacia B2"` |
| `AudioPlayer` | Reproducción por segmentos, velocidad, atajos | Botones de 44 px; el botón de reproducir es secundario |
| `Transcript` | Segmentos con hablante, karaoke por palabra, rasgos marcados | Palabras como `<button>` accesibles solo en fases con ayudas |
| `ReaderText` | Texto tokenizado, toque/pulsación larga, resaltado léxico | `.prose-reading`; sin saltos de diseño al resaltar |
| `WordLayer` | Glosa contextual + audio + acciones | Capa en `surface-2`; se cierra con `Esc` |
| `TaskInput` / `TaskRunner` | Cualquier tarea según su `type`, con su corrección | Respuestas con `.option`; corrección con `.feedback` |
| `DictationStep` | Entrada + diff palabra a palabra + selector de causa | Colores + iconos (nunca solo color) |
| `PhaseStepper` | Fases del ciclo | Lista ordenada de `.tag` |
| `RingProgress` | Minutos del día | Valor también en texto |
| `ReviewSession` | Tarjeta de repaso y sus cuatro notas | La nota sugerida es la acción cobalto |
| `CookieBanner` | Aceptar o rechazar las cookies de preferencias ([ADR-0028](../adr/0028-consentimiento-de-cookies.md)) | Capa flotante en `surface-2` (`.cookie-banner`); no bloquea; «Rechazar» y «Aceptar» son el mismo botón con borde, ninguno cobalto. La portada lleva el suyo, igual, en `public/landing` |

---

## 7. Movimiento

El de MASTER §6: transiciones de 150–200 ms solo en color, borde y opacidad; la barra de progreso anima su ancho en 300 ms; nada rebota ni entra animado. `prefers-reduced-motion: reduce` las desactiva todas.

---

## 8. Accesibilidad (WCAG 2.2 AA)

- Contraste (§2) y foco visible: anillo cobalto de 2 px con 2 px de separación.
- Todo el reproductor y el lector se manejan por **teclado** (atajos en [pantallas §4](02-pantallas-y-flujos.md#4-atajos-de-teclado)) y tienen etiquetas ARIA.
- Objetivos táctiles de 44 px (WCAG 2.2 pide ≥ 24 px; vamos holgados por ser de uso en movimiento).
- El color nunca es la única señal: aciertos y fallos llevan icono y texto, y se anuncian con `role="status"` o `role="alert"`.
- `lang="en"` en todo el contenido en inglés (los lectores de pantalla lo pronuncian bien) y `lang="es"` en la interfaz.
- Los e2e pasan axe (contraste incluido) en las pantallas que recorren.

---

## 9. Microcopy

- Tono: **cercano, directo y honesto**, en español de España, tuteando.
- Explica el porqué (en el plan, en los resultados).
- Los errores de la app nunca culpan al usuario.
- Vocabulario de «señal» con mesura: «Señal limpia» para un dictado perfecto sí; convertir cada botón en una metáfora, no.
