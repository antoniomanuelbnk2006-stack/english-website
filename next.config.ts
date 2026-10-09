import type { NextConfig } from 'next';

// La CSP (con nonce por petición) se añade en src/proxy.ts; aquí van las cabeceras fijas.
const securityHeaders = [
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
];

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
    return [{ source: '/(.*)', headers: securityHeaders }];
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
