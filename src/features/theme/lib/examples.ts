// Temas de ejemplo para «Tema personalizado» (ADR-0033): enseñan cómo se hace uno. Cambian las
// variables de color, que usa toda la app; los dos últimos tocan además un componente. Empiezan
// por `:root, [data-theme]` para valer en cualquier tema (oscuro, claro o según el sistema).

export const EXAMPLE_THEMES = [
  {
    id: 'sepia',
    css: `/* Sepia: claro y cálido, como papel viejo. */
:root,
[data-theme] {
  color-scheme: light;
  --canvas: #f3ead8;
  --surface: #fbf5e8;
  --surface-2: #e8dcc2;
  --border: #8a7757;
  --border-soft: #3b3222;
  --text: #2a2217;
  --muted: #5a4c37;
  --accent: #9b5a14;
  --accent-hover: #7f4a10;
  --accent-text: #7f4a10;
  --on-accent: #ffffff;
  --success: #2f6b3a;
  --error: #9e2f22;
  --warning: #7a5200;
  --logo-filter: brightness(0);
}`,
  },
  {
    id: 'contrast',
    css: `/* Alto contraste: negro, blanco y amarillo. */
:root,
[data-theme] {
  color-scheme: dark;
  --canvas: #000000;
  --surface: #0f0f0f;
  --surface-2: #1f1f1f;
  --border: #ffffff;
  --border-soft: #ffffff;
  --text: #ffffff;
  --muted: #f0f0f0;
  --accent: #ffd400;
  --accent-hover: #ffe14d;
  --accent-text: #ffd400;
  --on-accent: #000000;
  --success: #5cff9d;
  --error: #ff7a7a;
  --warning: #ffd400;
  --logo-filter: brightness(0) invert(1);
}

/* Las tarjetas, con borde. */
.card {
  border: 1px solid var(--border);
}`,
  },
  {
    id: 'neon',
    css: `/* Neón: violeta oscuro con un acento magenta. */
:root,
[data-theme] {
  color-scheme: dark;
  --canvas: #0c0717;
  --surface: #150d29;
  --surface-2: #21143f;
  --border: #8d6ad8;
  --border-soft: #eadfff;
  --text: #f4eeff;
  --muted: #cbbdf0;
  --accent: #cf2c88;
  --accent-hover: #b8287a;
  --accent-text: #ff8fd0;
  --on-accent: #ffffff;
  --success: #6cbf95;
  --error: #e07575;
  --warning: #d8ad5a;
  --logo-filter: brightness(0) invert(1);
}

/* Las tarjetas, con un borde del color del acento. */
.card {
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
}`,
  },
] as const;

export type ExampleThemeId = (typeof EXAMPLE_THEMES)[number]['id'];

/** Las variables que puede cambiar un tema (las de src/styles/globals.css), para la guía. */
export const THEME_VARIABLES = [
  '--canvas',
  '--surface',
  '--surface-2',
  '--border',
  '--border-soft',
  '--text',
  '--muted',
  '--accent',
  '--accent-hover',
  '--accent-text',
  '--on-accent',
  '--success',
  '--error',
  '--warning',
  '--logo-filter',
] as const;
