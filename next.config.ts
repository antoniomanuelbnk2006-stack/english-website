import type { NextConfig } from 'next';

// La CSP (con nonce por petición) se añade en src/proxy.ts; aquí van las cabeceras fijas.
const securityHeaders = [
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
];

const nextConfig: NextConfig = {
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
