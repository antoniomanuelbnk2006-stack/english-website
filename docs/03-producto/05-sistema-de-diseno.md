# Sistema de diseño

> **Propósito:** identidad visual, tokens, tipografía, componentes clave y reglas de accesibilidad. Estética: **oscura, limpia, sci-fi, con acentos cian y azul eléctrico** — pero al servicio de leer y escuchar durante mucho rato.
> **Relacionado:** [Pantallas](02-pantallas-y-flujos.md) · [PWA, rendimiento y accesibilidad](../04-arquitectura/08-pwa-rendimiento-accesibilidad.md)

---

## 1. Concepto

**«Del ruido a la señal.»** La interfaz se inspira en un receptor: paneles oscuros tipo HUD, una forma de onda que se anima cuando suena el audio, barras de señal como indicador de nivel y datos en tipografía monoespaciada.

Dos modos de intensidad:
- **Modo panel** (Hoy, Progreso, bibliotecas): más HUD, más datos, acentos cian visibles.
- **Modo enfoque** (lector, transcripción, tarjetas): el cromo desaparece, tipografía grande, contraste suave, cero distracciones.

---

## 2. Tokens

Se definen como variables CSS semánticas y se exponen a Tailwind v4 con `@theme inline` (el mismo patrón que usa shadcn/ui).

```css
/* src/styles/globals.css */
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

:root,
[data-theme="dark"] {
  --bg: #070b14;            /* espacio profundo */
  --surface: #0d1422;       /* paneles */
  --surface-2: #131c2e;     /* paneles elevados, popovers */
  --border: #1e2a40;
  --text: #e6edf7;
  --text-muted: #93a3bd;
  --text-subtle: #64748b;
  --accent: #22d3ee;        /* cian: acción principal, señal */
  --accent-strong: #06b6d4;
  --accent-contrast: #04111a; /* texto sobre --accent */
  --electric: #3b82f6;      /* azul eléctrico: secundario, gráficos */
  --success: #34d399;
  --warning: #fbbf24;
  --danger: #f87171;
  --karaoke: rgb(34 211 238 / 0.18);
  --word-unknown: rgb(34 211 238 / 0.55);   /* subrayado */
  --word-learning: rgb(251 191 36 / 0.6);   /* subrayado */
  --focus: #67e8f9;
}

[data-theme="light"] {
  --bg: #f8fafc;  --surface: #ffffff;  --surface-2: #f1f5f9;  --border: #e2e8f0;
  --text: #0f172a; --text-muted: #475569; --text-subtle: #64748b;
  --accent: #0e7490; --accent-strong: #155e75; --accent-contrast: #ffffff;
  --electric: #2563eb; --success: #047857; --warning: #b45309; --danger: #b91c1c;
  --karaoke: rgb(14 116 144 / 0.14); --word-unknown: rgb(14 116 144 / 0.5);
  --word-learning: rgb(180 83 9 / 0.5); --focus: #0e7490;
}

[data-theme="paper"] {       /* solo para el lector y las tarjetas */
  --bg: #f7f4ec;  --surface: #fbf9f3;  --surface-2: #efeadf;  --border: #e2dccd;
  --text: #1f2328; --text-muted: #57534e; --text-subtle: #78716c;
  --accent: #155e75; --accent-strong: #164e63; --accent-contrast: #ffffff;
  --electric: #2563eb; --success: #047857; --warning: #92400e; --danger: #b91c1c;
  --karaoke: rgb(14 116 144 / 0.14); --focus: #155e75;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-border: var(--border);
  --color-text: var(--text);
  --color-muted: var(--text-muted);
  --color-subtle: var(--text-subtle);
  --color-accent: var(--accent);
  --color-accent-strong: var(--accent-strong);
  --color-accent-contrast: var(--accent-contrast);
  --color-electric: var(--electric);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
  --font-reading: var(--font-literata), Georgia, serif;
  --radius-panel: 24px;
  --radius-control: 10px;
}
```

**Reglas:**
- En componentes, solo clases semánticas (`bg-surface`, `text-muted`, `border-border`). **Nunca hex sueltos.**
- El tema se aplica con `data-theme` en `<html>` (por defecto: oscuro; opción «según el sistema»). El lector puede forzar `paper` en su contenedor.
- Contraste comprobado: texto principal ≥ 7:1 y texto secundario ≥ 4,5:1 en los tres temas; el cian oscuro (#0e7490) se usa en claro porque el cian brillante no alcanza 4,5:1 sobre blanco.
- Los colores de estado (`accent`, `success`, `warning`, `danger`) también se usan como texto, así que deben llegar a 4,5:1 sobre `bg`, `surface` y `surface-2`. Lo garantiza `src/styles/contrast.test.ts`, que falla si un cambio de token baja de ahí.
- `--text-subtle` no llega a 4,5:1 sobre los fondos oscuros: solo para iconos, bordes y *placeholders*, nunca para texto.

---

## 3. Tipografía

| Uso | Fuente | Licencia | Carga |
|---|---|---|---|
| Interfaz | **Geist Sans** | OFL | `next/font/google`, variable |
| Datos, tiempos, contadores (HUD) | **Geist Mono** | OFL | `next/font/google` |
| Lectura larga (lector, transcripción, tarjetas) | **Literata** | OFL | `next/font/google`, variable, `display: swap` |

| Token | Tamaño / interlineado | Uso |
|---|---|---|
| `text-xs` | 12 / 16 | Metadatos |
| `text-sm` | 14 / 20 | Secundario |
| `text-base` | 16 / 24 | Interfaz |
| `reading-md` | 19 / 32 (1,7) | Lector por defecto |
| `reading-lg` | 22 / 36 | Lector grande |
| `text-2xl` | 24 / 32 | Títulos de sección |
| `text-4xl` | 36 / 40 | Títulos de pantalla (Hoy) |

- Lector: medida de **60–72 caracteres**, `hyphens: auto` desactivado (las palabras deben verse completas para tocarlas), `text-wrap: pretty`.
- Números del HUD con `font-variant-numeric: tabular-nums`.

---

## 4. Espaciado, forma y elevación

- Escala de espaciado de Tailwind (múltiplos de 4 px). Márgenes de pantalla: 16 px en móvil, 24–32 px en escritorio.
- Radios: paneles 24 px, controles de formulario 10 px; botones y *chips* totalmente redondeados ([ADR-0022](../adr/0022-diseno-de-la-presentacion-en-toda-la-web.md)).
- Movimiento: el hover de los botones los subraya y los sube 2 px; el título de cada pantalla entra inclinándose y los paneles giran hacia delante al entrar en pantalla (solo con *scroll-driven animations*). Todo se anula con `prefers-reduced-motion`.
- Elevación con **bordes y luminosidad**, no con sombras (en oscuro las sombras no se ven): `surface` → `surface-2` + borde.
- «Brillo» sutil en elementos activos: `box-shadow: 0 0 0 1px var(--accent), 0 0 24px -8px var(--accent)`.

---

## 5. Iconografía y motivos

- Iconos: **lucide-react**, trazo 1,75 px, 20 px en interfaz.
- Motivo principal: **forma de onda** (picos precalculados del audio, ver [modelo de contenido](../04-arquitectura/04-modelo-de-contenido.md)), que se ilumina en cian hasta la posición actual.
- **Barras de señal** para el nivel (ver [gamificación §4](04-gamificacion.md#4-barras-de-señal-el-nivel)).

---

## 6. Componentes

Base: **shadcn/ui** (Radix + Tailwind) para lo genérico (botón, diálogo, *popover*, pestañas, *tooltip*, *select*, *toast*). Componentes propios:

| Componente | Responsabilidad | Notas de diseño |
|---|---|---|
| `SignalBars` | Nivel por destreza (6 barras + relleno parcial) | `aria-label="Listening: B1, 63 % hacia B2"` |
| `AudioPlayer` | Reproducción por segmentos, velocidad, atajos | Botones ≥ 44 px; forma de onda; tiempo en mono |
| `Waveform` | Dibuja picos y progreso | `<canvas>` o SVG; respeta `prefers-reduced-motion` |
| `Transcript` | Segmentos con hablante, karaoke por palabra, rasgos marcados | Palabras como `<button>` accesibles solo en fases con ayudas |
| `ReaderText` | Texto tokenizado, toque/pulsación larga, resaltado léxico | Tipografía de lectura; sin saltos de diseño al resaltar |
| `WordPopover` | Glosario contextual + audio + acciones | Se cierra con `Esc`; foco atrapado |
| `TaskRenderer` | Renderiza cualquier tarea según `type` | Un componente por tipo; corrección uniforme |
| `DictationInput` | Entrada + diff palabra a palabra + selector de causa | Colores + iconos (nunca solo color) |
| `PhaseStepper` | Fases del ciclo | Accesible como lista ordenada |
| `RingProgress` | Minutos del día | Valor también en texto |
| `ReviewCard` | Tarjeta SRS (anverso/reverso) | Animación de giro desactivable |
| `StatTile` | Cifra + variación | Mono, tabular |

---

## 7. Movimiento

- Transiciones de 150–220 ms, `ease-out`. Nada parpadea ni rebota.
- La forma de onda «respira» solo mientras suena el audio.
- `prefers-reduced-motion: reduce` → sin animaciones decorativas; se mantienen los cambios de estado instantáneos.
- Transiciones entre fases con View Transitions de React 19.2 solo si no penalizan el rendimiento.

---

## 8. Accesibilidad (WCAG 2.2 AA)

- Contraste (§2), foco visible con `--focus` (anillo de 2 px + separación de 2 px).
- Todo el reproductor y el lector se manejan por **teclado** (atajos en [pantallas §4](02-pantallas-y-flujos.md#4-atajos-de-teclado)) y tienen etiquetas ARIA.
- Objetivos táctiles ≥ 44×44 px (WCAG 2.2 pide ≥ 24 px; vamos holgados por ser de uso en movimiento).
- El color nunca es la única señal (aciertos/fallos con icono y texto).
- `lang="en"` en todo el contenido en inglés (los lectores de pantalla lo pronuncian bien) y `lang="es"` en la interfaz.
- Tamaño de letra del lector ajustable sin romper el diseño hasta 200 %.

---

## 9. Microcopy

- Tono: **cercano, directo y honesto**, en español de España, tuteando.
- Explica el porqué (en el plan, en los resultados).
- Los errores de la app nunca culpan al usuario.
- Vocabulario de «señal» con mesura: «Señal limpia» para un dictado perfecto sí; convertir cada botón en una metáfora, no.
