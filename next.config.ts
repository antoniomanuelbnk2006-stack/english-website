import type { NextConfig } from 'next';

// La CSP (con nonce por petición) se añade en src/proxy.ts; aquí van las cabeceras fijas.
const securityHeaders = [
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Lo mismo que `frame-ancestors 'none'` de las dos CSP, para los navegadores que no la entienden
  // y para lo que se sirve sin CSP (estáticos de Next, audio local).
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
];

// CSP fija de la portada pública (public/landing): HTML estático, sin nonce. Comparte origen con
// la app, así que solo admite lo que esas páginas cargan de verdad (su script, su hoja de
// estilos, las fuentes de Google y las fotos de Wix) y no se deja incrustar en otra web.
const landingCsp = [
  `default-src 'self'`,
  `script-src 'self'`,
  // Las páginas llevan algunos estilos en el propio HTML (`style="…"`).
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `img-src 'self' data: https://static.wixstatic.com`,
  `connect-src 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ');
const landingHeaders = [{ key: 'Content-Security-Policy', value: landingCsp }];

// Los tests e2e compilan en su propia carpeta (con su propio tsconfig, para que Next no
// toque el del proyecto) y así no pisan la compilación que esté sirviendo `pnpm demo`.
const distDir = process.env.NEXT_DIST_DIR || '.next';

const nextConfig: NextConfig = {
  distDir,
  typescript: { tsconfigPath: distDir === '.next' ? 'tsconfig.json' : 'tsconfig.e2e.json' },
  // Sin Cache Components en v1 (docs/04-arquitectura/02-arquitectura-y-carpetas.md §5).
  typedRoutes: true,
  poweredByHeader: false,
  // El contenido se lee con fs en tiempo de ejecución: hay que incluirlo en las funciones (ADR-0003).
  outputFileTracingIncludes: {
    '/*': ['content/**/*.json', 'content/**/*.mdx'],
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // «/» es la portada para quien no ha entrado: src/proxy.ts la sirve desde /landing. Con
      // sesión, «/» solo redirige a /hoy y esa respuesta lleva la CSP de la app.
      { source: '/', headers: landingHeaders },
      { source: '/landing/:path*', headers: landingHeaders },
    ];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
